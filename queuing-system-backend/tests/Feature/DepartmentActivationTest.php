<?php

namespace Tests\Feature;

use App\Models\DisplaySetting;
use App\Models\QueueTicket;
use App\Models\ServiceWindow;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DepartmentActivationTest extends TestCase
{
    use RefreshDatabase;

    private function enable(array $departments = ['Cashier', 'Registrar', 'ITM', 'Admission']): void
    {
        DisplaySetting::updateOrCreate(['id' => 1], ['settings' => ['enabledDepartments' => $departments]]);
    }

    private function staff(string $department): User
    {
        $staff = User::create(['username' => strtolower($department).'1', 'full_name' => $department.' Staff',
            'password' => 'password', 'role' => 'staff', 'position' => strtolower($department), 'status' => 'active']);
        ServiceWindow::whereRaw('LOWER(department) = ?', [strtolower($department)])
            ->where('window_number', 1)->update(['staff_id' => $staff->user_id, 'status' => 'open', 'is_available' => true]);
        return $staff;
    }

    private function waitingTicket(string $number, string $serviceType): QueueTicket
    {
        return QueueTicket::create([
            'ticket_number' => $number,
            'service_type' => $serviceType,
            'priority_type' => 'R',
            'status' => 'waiting',
            'created_at' => now(),
        ]);
    }

    public function test_assessment_alias_uses_adm_queue_without_mixing_services(): void
    {
        $this->enable(['Cashier', 'Registrar', 'ITM', 'Assessment']);
        $itmStaff = $this->staff('ITM');
        $admissionStaff = $this->staff('Admission');
        $cashier = $this->waitingTicket('C-R001', 'C');
        $registrar = $this->waitingTicket('R-R001', 'R');
        $itm = $this->waitingTicket('ITMN-0001', 'ITM');
        $assessment = (object) $this->postJson('/api/queue/generate', ['service_type' => 'Assessment'])
            ->assertCreated()->assertJsonPath('ticket.service_type', 'ADM')
            ->json('ticket');

        foreach ([
            'CS' => ['C', $cashier],
            'RT' => ['R', $registrar],
            'ITM' => ['ITM', $itm],
            'Assessment' => ['ADM', $assessment],
        ] as $requestedType => [$storedType, $ticket]) {
            $this->getJson('/api/queue/waiting?service_type='.$requestedType)
                ->assertOk()->assertJsonCount(1)->assertJsonPath('0.service_type', $storedType)
                ->assertJsonPath('0.ticket_id', $ticket->ticket_id);
        }

        Sanctum::actingAs($itmStaff);
        $this->getJson('/api/staff/queue/waiting')->assertOk()
            ->assertJsonCount(1)->assertJsonPath('0.ticket_id', $itm->ticket_id);
        $this->postJson('/api/queue/call')->assertOk()
            ->assertJsonPath('ticket.service_type', 'ITM');

        Sanctum::actingAs($admissionStaff);
        $this->getJson('/api/staff/queue/waiting')->assertOk()
            ->assertJsonCount(1)->assertJsonPath('0.ticket_id', $assessment->ticket_id);
        $this->postJson('/api/queue/call')->assertOk()
            ->assertJsonPath('ticket.service_type', 'ADM');

        $this->getJson('/api/queue/serving?service_type=ITM')->assertOk()
            ->assertJsonCount(1)->assertJsonPath('0.service_type', 'ITM')
            ->assertJsonPath('0.ticket_id', $itm->ticket_id);
        $this->getJson('/api/queue/serving?service_type=Assessment')->assertOk()
            ->assertJsonCount(1)->assertJsonPath('0.service_type', 'ADM')
            ->assertJsonPath('0.ticket_id', $assessment->ticket_id);

        $this->enable(['Cashier', 'Registrar', 'ITM']);
        $this->getJson('/api/queue/waiting?service_type=Assessment')->assertOk()->assertJsonCount(0);
        $this->getJson('/api/queue/waiting?service_type=ITM')->assertOk()->assertJsonCount(0);
        $this->getJson('/api/queue/waiting?service_type=CS')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/queue/waiting?service_type=RT')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/queue/serving?service_type=ITM')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/queue/serving?service_type=Assessment')->assertOk()->assertJsonCount(0);
    }

    public function test_admin_can_enable_multiple_departments_and_other_roles_cannot_publish(): void
    {
        $admin = User::create(['username' => 'admin', 'full_name' => 'Admin', 'password' => 'password', 'role' => 'admin', 'status' => 'active']);
        Sanctum::actingAs($admin);
        $payload = ['settings' => ['schoolName' => 'Preserved', 'enabledDepartments' => ['Cashier', 'Registrar', 'ITM']], 'windows' => [
            ['windowNumber' => 1, 'displayName' => 'Cashier Window 1', 'department' => 'Cashier', 'color' => '#2563eb', 'visible' => true],
        ]];
        $this->putJson('/api/display-configuration', $payload)->assertOk()
            ->assertJsonPath('settings.enabledDepartments', ['Cashier', 'Registrar', 'ITM'])
            ->assertJsonPath('settings.schoolName', 'Preserved');
        $payload['settings']['enabledDepartments'][] = 'Admission';
        $this->putJson('/api/display-configuration', $payload)->assertOk()->assertJsonCount(4, 'settings.enabledDepartments');
        $this->getJson('/api/display-configuration')->assertOk()->assertJsonFragment(['department' => 'Admission']);
        Sanctum::actingAs($this->staff('Admission'));
        $this->putJson('/api/display-configuration', $payload)->assertForbidden();
    }

    public function test_each_new_department_uses_shared_priority_call_complete_history_and_reports(): void
    {
        $this->enable();
        User::create(['username' => 'guard', 'full_name' => 'Guard', 'password' => 'password', 'role' => 'security', 'status' => 'active', 'security_code' => '1234']);
        foreach (['ITM' => 'ITM', 'Admission' => 'ADM'] as $department => $type) {
            $staff = $this->staff($department);
            $regular = $this->postJson('/api/queue/generate', ['service_type' => $type, 'priority_type' => 'R', 'student_number' => '1234-23', 'transaction_type' => $department.' Service'])
                ->assertCreated()->assertJsonPath('ticket.ticket_number', $type.'N-0001')->json('ticket.ticket_id');
            $priority = $this->postJson('/api/queue/generate', ['service_type' => $type, 'priority_type' => 'P', 'security_code' => '1234', 'student_number' => 'Guest', 'transaction_type' => $department.' Service'])
                ->assertCreated()->assertJsonPath('ticket.ticket_number', $type.'P-0001')->json('ticket.ticket_id');
            Sanctum::actingAs($staff);
            $this->getJson('/api/staff/current-window')->assertOk()->assertJsonPath('department', $department);
            $this->getJson('/api/staff/queue/waiting')->assertOk()->assertJsonCount(2)->assertJsonPath('0.ticket_id', $priority);
            $this->postJson('/api/queue/call')->assertOk()->assertJsonPath('ticket.ticket_id', $priority)->assertJsonPath('ticket.window', 1);
            $this->postJson('/api/queue/call')->assertOk()->assertJsonPath('already_active', true);
            $this->putJson('/api/queue/'.$priority.'/complete')->assertOk()->assertJsonPath('ticket.status', 'done');
            $this->assertDatabaseHas('service_transactions', ['ticket_id' => $priority, 'staff_id' => $staff->user_id]);
            $this->assertNotNull(QueueTicket::find($priority)->completed_at);
            $this->assertNotNull(QueueTicket::find($priority)->called_at);
            $this->getJson('/api/queue-history?period=all')->assertOk()->assertJsonFragment(['department' => $department]);
            $this->getJson('/api/activity-logs')->assertOk()->assertJsonFragment(['action' => 'Called ticket: '.$type.'P-0001']);
            $this->getJson('/api/reports?department='.$department)->assertOk()->assertJsonPath('report_summary.completed', 1);
            $this->getJson('/api/analytics/dashboard?department='.$department)->assertOk()->assertJsonPath('completed_tickets_count', 1);
            $this->getJson('/api/analytics/transactions?department='.$department)->assertOk()->assertJsonPath('total_transactions', 1);
            $this->getJson('/api/analytics/department-comparison?department='.$department)->assertOk()->assertJsonPath('0.department', $department)->assertJsonPath('0.customers_served', 1);
            $this->postJson('/api/queue/call')->assertOk()->assertJsonPath('ticket.ticket_id', $regular);
            $this->putJson('/api/queue/'.$regular.'/complete')->assertOk();
        }
    }

    public function test_disabled_department_blocks_existing_staff_sessions_login_and_kiosk_without_deleting_history(): void
    {
        $this->enable();
        $staff = $this->staff('Admission');
        $id = $this->postJson('/api/queue/generate', ['service_type' => 'ADM'])->assertCreated()->json('ticket.ticket_id');
        Sanctum::actingAs($staff);
        $this->postJson('/api/queue/call')->assertOk();
        $this->putJson('/api/queue/'.$id.'/complete')->assertOk();
        $this->enable(['Cashier', 'Registrar']);
        $this->postJson('/api/login', ['username' => 'admission1', 'password' => 'password'])->assertForbidden();
        $this->postJson('/api/queue/generate', ['service_type' => 'ADM'])->assertForbidden();
        $this->postJson('/api/queue/call')->assertForbidden();
        $this->getJson('/api/staff/queue/waiting')->assertForbidden();
        $this->patchJson('/api/staff/window/status', ['status' => 'open'])->assertForbidden();
        $this->getJson('/api/reports?department=Admission')->assertOk()->assertJsonPath('report_summary.completed', 1);
        $this->assertDatabaseHas('queue_tickets', ['ticket_id' => $id, 'status' => 'done']);
        $this->enable();
        $this->getJson('/api/staff/queue/waiting')->assertOk();
        $this->postJson('/api/queue/generate', ['service_type' => 'ADM'])->assertCreated()->assertJsonPath('ticket.ticket_number', 'ADMN-0002');
    }

    public function test_closed_or_unassigned_new_department_windows_cannot_issue_or_call(): void
    {
        $this->enable();
        $this->postJson('/api/queue/generate', ['service_type' => 'ADM'])->assertStatus(409);
        $staff = $this->staff('Admission');
        $this->postJson('/api/queue/generate', ['service_type' => 'ADM'])->assertCreated();
        Sanctum::actingAs($staff);
        $this->patchJson('/api/staff/window/status', ['status' => 'closed'])->assertForbidden();
        $this->putJson('/api/staff/window', ['status' => 'closed'])->assertForbidden();
        $this->assertDatabaseHas('service_windows', [
            'department' => 'Admission',
            'window_number' => 1,
            'staff_id' => $staff->user_id,
            'status' => 'open',
            'is_available' => true,
        ]);
        $this->postJson('/api/queue/call')->assertOk();
        $this->assertDatabaseMissing('service_logs', ['user_id' => $staff->user_id, 'action' => 'Admission Window 1 closed']);
    }

    public function test_same_numbered_windows_in_different_departments_both_appear_on_display(): void
    {
        $this->enable();
        foreach (['ITM' => 'ITM', 'Admission' => 'ADM'] as $department => $type) {
            $staff = $this->staff($department);
            $this->postJson('/api/queue/generate', ['service_type' => $type])->assertCreated();
            Sanctum::actingAs($staff);
            $this->postJson('/api/queue/call')->assertOk();
        }
        $this->getJson('/api/queue/serving')->assertOk()->assertJsonCount(2);
    }

    public function test_new_department_cannot_complete_another_departments_ticket(): void
    {
        $this->enable();
        $itm = $this->staff('ITM');
        $admission = $this->staff('Admission');
        $id = $this->postJson('/api/queue/generate', ['service_type' => 'ITM'])->assertCreated()->json('ticket.ticket_id');
        Sanctum::actingAs($itm);
        $this->postJson('/api/queue/call')->assertOk();
        Sanctum::actingAs($admission);
        $this->putJson('/api/queue/'.$id.'/complete')->assertForbidden();
        $this->getJson('/api/staff/queue/waiting')->assertOk()->assertJsonCount(0);
    }

    public function test_admin_can_register_admission_staff_and_assignment_errors_are_atomic(): void
    {
        $this->enable();
        $admin = User::create(['username' => 'admin', 'full_name' => 'Admin', 'password' => 'password', 'role' => 'admin', 'status' => 'active']);
        Sanctum::actingAs($admin);
        $window = ServiceWindow::where('department', 'Admission')->firstOrFail();
        $data = ['username' => 'admission-staff', 'full_name' => 'Admission Staff', 'password' => 'password', 'password_confirmation' => 'password', 'role' => 'staff', 'position' => 'admission', 'assigned_window_id' => $window->id];
        $this->postJson('/api/register', $data)->assertCreated();
        $this->postJson('/api/login', ['username' => $data['username'], 'password' => 'password'])->assertOk();
        $data['username'] = 'invalid-assignment';
        $this->postJson('/api/register', $data)->assertStatus(422);
        $this->assertDatabaseMissing('users', ['username' => 'invalid-assignment']);
    }

    public function test_all_departments_can_be_disabled_and_numbering_continues_past_999(): void
    {
        $this->enable();
        $this->staff('Admission');
        QueueTicket::create(['ticket_number' => 'ADMN-0999', 'service_type' => 'ADM', 'priority_type' => 'R', 'status' => 'done', 'created_at' => now()]);
        $this->postJson('/api/queue/generate', ['service_type' => 'ADM'])->assertCreated()->assertJsonPath('ticket.ticket_number', 'ADMN-1000');
        $this->enable([]);
        $this->getJson('/api/display-configuration')->assertOk()->assertJsonPath('settings.enabledDepartments', []);
        $this->getJson('/api/queue/waiting')->assertOk()->assertJsonCount(0);
        $this->getJson('/api/queue/serving')->assertOk()->assertJsonCount(0);
        $this->postJson('/api/queue/generate', ['service_type' => 'CS'])->assertForbidden();
        $this->assertDatabaseCount('queue_tickets', 2);
    }
}
