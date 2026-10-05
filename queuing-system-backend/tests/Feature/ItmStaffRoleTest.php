<?php

namespace Tests\Feature;

use App\Models\QueueTicket;
use App\Models\DisplaySetting;
use App\Models\ServiceTransaction;
use App\Models\ServiceWindow;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ItmStaffRoleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        \App\Models\DisplaySetting::create(['settings' => ['enabledDepartments' => ['Cashier', 'Registrar', 'ITM']]]);
    }

    private function staff(string $position, string $username): User
    {
        return User::create([
            'username' => $username,
            'password' => 'password',
            'full_name' => strtoupper($position) . ' Staff',
            'role' => 'staff',
            'position' => $position,
            'status' => 'active',
        ]);
    }

    private function ticket(string $number, string $service, string $priority = 'R'): QueueTicket
    {
        return QueueTicket::create([
            'ticket_number' => $number,
            'service_type' => $service,
            'priority_type' => $priority,
            'status' => 'waiting',
            'created_at' => now(),
        ]);
    }

    private function assignItmWindow(User $staff): ServiceWindow
    {
        $window = ServiceWindow::whereRaw('LOWER(department) = ?', ['itm'])->where('window_number', 1)->firstOrFail();
        $window->update(['service_type' => 'ITM', 'service_scope' => 'department', 'staff_id' => $staff->user_id]);
        return $window;
    }

    public function test_enabled_itm_department_can_generate_and_serve_a_ticket(): void
    {
        $itm = $this->staff('itm', 'itm-mode-staff');
        $this->assignItmWindow($itm);

        $generated = $this->postJson('/api/queue/generate', [
            'service_type' => 'ITM',
            'priority_type' => 'R',
            'transaction_type' => 'ITM Service',
            'student_number' => 'Guest',
        ])->assertCreated()
            ->assertJsonPath('ticket.service_type', 'ITM');
        $generated->assertJsonPath('ticket.ticket_number', 'ITMN-0001');

        $ticketId = $generated->json('ticket.ticket_id');
        Sanctum::actingAs($itm);

        $this->getJson('/api/staff/queue/waiting')
            ->assertOk()
            ->assertJsonPath('0.ticket_id', $ticketId);
        $this->postJson('/api/queue/call')
            ->assertOk()
            ->assertJsonPath('ticket.ticket_id', $ticketId)
            ->assertJsonPath('ticket.window', 1);

        $this->getJson('/api/queue/serving?service_type=ITM')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.ticket_id', $ticketId)
            ->assertJsonPath('0.service_type', 'ITM');
    }

    public function test_three_itm_staff_windows_call_distinct_tickets_and_publish_separate_display_panels(): void
    {
        $staffOne = $this->staff('itm', 'itm');
        $windowOne = ServiceWindow::whereRaw('LOWER(department) = ?', ['itm'])
            ->where('window_number', 1)
            ->firstOrFail();
        $windowOne->update([
            'service_type' => 'ITM',
            'service_scope' => 'department',
            'staff_id' => $staffOne->user_id,
            'is_available' => true,
            'status' => 'open',
        ]);
        $existingItmPassword = $staffOne->getRawOriginal('password');
        $this->seed(\Database\Seeders\ITMStaffSeeder::class);
        $this->seed(\Database\Seeders\ITMStaffWindowsSeeder::class);
        $this->assertSame($existingItmPassword, User::where('username', 'itm')->firstOrFail()->getRawOriginal('password'));

        $staff = [
            1 => $staffOne,
            2 => User::where('username', 'itm2')->firstOrFail(),
            3 => User::where('username', 'itm3')->firstOrFail(),
        ];
        foreach ([2, 3] as $windowNumber) {
            $this->assertDatabaseHas('users', [
                'username' => 'itm'.$windowNumber,
                'full_name' => 'ITM Staff '.$windowNumber,
                'position' => 'itm',
                'role' => 'staff',
                'status' => 'active',
            ]);
            $this->assertDatabaseHas('service_windows', [
                'department' => 'ITM',
                'window_number' => $windowNumber,
                'staff_id' => $staff[$windowNumber]->user_id,
                'service_type' => 'ITM',
            ]);
            $this->assertNotSame('itm123', $staff[$windowNumber]->getRawOriginal('password'));
        }

        $ticketIds = [];
        foreach ([1, 2, 3] as $windowNumber) {
            $ticketIds[] = $this->postJson('/api/queue/generate', [
                'service_type' => 'ITM',
                'transaction_type' => 'ITM Service',
            ])->assertCreated()->json('ticket.ticket_id');
        }

        foreach ([1, 2, 3] as $index => $windowNumber) {
            Sanctum::actingAs($staff[$windowNumber]);
            $this->getJson('/api/staff/queue/waiting')
                ->assertOk()
                ->assertJsonCount(3 - $index);
            $this->postJson('/api/queue/call')
                ->assertOk()
                ->assertJsonPath('ticket.ticket_id', $ticketIds[$index])
                ->assertJsonPath('ticket.service_type', 'ITM')
                ->assertJsonPath('ticket.window', $windowNumber);
            $this->getJson('/api/staff/current-ticket')
                ->assertOk()
                ->assertJsonPath('ticket.ticket_id', $ticketIds[$index]);
        }

        $cashier = $this->staff('cashier', 'cashier-display-window-1');
        $cashierTicket = QueueTicket::create([
            'ticket_number' => 'C-R001',
            'service_type' => 'C',
            'priority_type' => 'R',
            'status' => 'serving',
            'window' => 1,
            'created_at' => now(),
        ]);
        ServiceTransaction::create([
            'ticket_id' => $cashierTicket->ticket_id,
            'staff_id' => $cashier->user_id,
            'start_time' => now(),
        ]);

        $this->getJson('/api/queue/serving?service_type=ITM')->assertOk()->assertJsonCount(3);
        $allServing = $this->getJson('/api/queue/serving')->assertOk()->json();
        $this->assertCount(4, $allServing);
        $this->assertSame($cashierTicket->ticket_id, collect($allServing)->firstWhere('service_type', 'C')['ticket_id']);
        $servingByWindow = collect($allServing)->where('service_type', 'ITM')->keyBy('window');
        $this->assertCount(3, $servingByWindow);
        foreach ([1, 2, 3] as $index => $windowNumber) {
            $this->assertSame($ticketIds[$index], $servingByWindow[$windowNumber]['ticket_id']);
        }

        $this->getJson('/api/display-configuration')
            ->assertOk()
            ->assertJsonFragment(['department' => 'ITM', 'windowNumber' => 1])
            ->assertJsonFragment(['department' => 'ITM', 'windowNumber' => 2])
            ->assertJsonFragment(['department' => 'ITM', 'windowNumber' => 3]);
    }

    public function test_normal_staff_and_itm_waiting_lists_are_authorized_by_role_and_mode(): void
    {
        $cashier = $this->staff('cashier', 'cashier7');
        $registrar = $this->staff('registrar', 'registrar7');
        $itm = $this->staff('itm', 'reliever');
        $this->assignItmWindow($itm);
        $this->ticket('C-R001', 'C');
        $registrarTicket = $this->ticket('R-R001', 'R');
        ServiceWindow::create([
            'department' => 'registrar',
            'window_number' => 9,
            'service_type' => 'RT',
            'service_scope' => 'department',
            'staff_id' => $registrar->user_id,
            'is_available' => true,
            'status' => 'open',
        ]);
        $registrarTicket->update(['window' => 9]);
        $this->ticket('ITMN-0001', 'ITM');

        Sanctum::actingAs($cashier);
        $this->getJson('/api/staff/queue/waiting')->assertOk()->assertJsonCount(1)->assertJsonPath('0.service_type', 'C');
        Sanctum::actingAs($registrar);
        $this->getJson('/api/staff/queue/waiting')->assertOk()->assertJsonCount(1)->assertJsonPath('0.service_type', 'R');
        Sanctum::actingAs($itm);
        $this->getJson('/api/staff/queue/waiting')->assertOk()->assertJsonCount(1)->assertJsonPath('0.service_type', 'ITM');
    }

    public function test_itm_waiting_queue_does_not_require_a_staff_or_ticket_window_number(): void
    {
        $itm = $this->staff('itm', 'itm-without-window');
        $ticket = $this->ticket('ITMN-0001', 'ITM');
        $this->ticket('C-R001', 'C');
        $this->ticket('R-R001', 'R');

        Sanctum::actingAs($itm);
        $this->getJson('/api/staff/queue/waiting')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.ticket_id', $ticket->ticket_id)
            ->assertJsonPath('0.service_type', 'ITM')
            ->assertJsonPath('0.window', null);
    }

    public function test_unnumbered_serving_itm_ticket_is_returned_for_now_serving_display(): void
    {
        $itm = $this->staff('itm', 'itm-serving-without-window');
        $ticket = QueueTicket::create([
            'ticket_number' => 'ITMN-0001',
            'service_type' => 'ITM',
            'priority_type' => 'R',
            'status' => 'serving',
            'window' => null,
            'created_at' => now(),
            'called_at' => now(),
        ]);
        ServiceTransaction::create([
            'ticket_id' => $ticket->ticket_id,
            'staff_id' => $itm->user_id,
            'start_time' => now(),
        ]);

        $this->getJson('/api/queue/serving?service_type=ITM')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.ticket_id', $ticket->ticket_id)
            ->assertJsonPath('0.service_type', 'ITM')
            ->assertJsonPath('0.window', null);
    }

    public function test_same_numbered_cashier_itm_and_admission_windows_keep_queues_and_serving_tickets_separate(): void
    {
        DisplaySetting::updateOrCreate(['id' => 1], [
            'settings' => ['enabledDepartments' => ['Cashier', 'Registrar', 'ITM', 'Admission']],
        ]);

        $cashier = $this->staff('cashier', 'cashier-board');
        $cashierWindow = ServiceWindow::firstOrCreate(
            ['department' => 'Cashier', 'window_number' => 1],
            ['service_type' => 'CS', 'status' => 'open', 'is_available' => true]
        );
        $cashierWindow->update([
            'staff_id' => $cashier->user_id,
            'service_scope' => 'department',
            'status' => 'open',
            'is_available' => true,
        ]);
        $itm = $this->staff('itm', 'itm-board');
        $itmWindow = $this->assignItmWindow($itm);
        $admission = $this->staff('admission', 'admission-board');
        $admissionWindow = ServiceWindow::where('department', 'Admission')->where('window_number', 1)->firstOrFail();
        $admissionWindow->update([
            'staff_id' => $admission->user_id, 'service_type' => 'ADM', 'service_scope' => 'department',
            'status' => 'open', 'is_available' => true,
        ]);

        $ticketIds = [];
        foreach ([
            [$cashier, 'C', 'C-R001', $cashierWindow],
            [$itm, 'ITM', 'ITMN-0001', $itmWindow],
            [$admission, 'ADM', 'ADMN-0001', $admissionWindow],
        ] as [$staff, $service, $number, $window]) {
            $ticket = $this->ticket($number, $service);
            $ticketIds[$service] = $ticket->ticket_id;

            Sanctum::actingAs($staff);
            $this->getJson('/api/staff/queue/waiting')
                ->assertOk()->assertJsonCount(1)->assertJsonPath('0.ticket_id', $ticket->ticket_id);
            $this->postJson('/api/queue/call')
                ->assertOk()
                ->assertJsonPath('ticket.ticket_id', $ticket->ticket_id)
                ->assertJsonPath('ticket.window', 1)
                ->assertJsonPath('transaction.staff_id', $staff->user_id);
            $this->assertSame(1, (int) $window->fresh()->window_number);
        }

        $serving = $this->getJson('/api/queue/serving')->assertOk()->assertJsonCount(3)->json();
        $this->assertEqualsCanonicalizing(
            array_map(fn ($ticket) => [$ticket['service_type'], (int) $ticket['window'], $ticket['ticket_id']], $serving),
            [['C', 1, $ticketIds['C']], ['ITM', 1, $ticketIds['ITM']], ['ADM', 1, $ticketIds['ADM']]]
        );
        foreach ([
            ['C', $cashier],
            ['ITM', $itm],
            ['ADM', $admission],
        ] as [$service, $staff]) {
            $this->assertDatabaseHas('service_transactions', [
                'ticket_id' => $ticketIds[$service],
                'staff_id' => $staff->user_id,
                'end_time' => null,
            ]);
        }
    }

    public function test_itm_uses_priority_then_fifo_without_consuming_other_departments(): void
    {
        $itm = $this->staff('itm', 'itm1');
        $this->assignItmWindow($itm);
        $this->ticket('C-R001', 'C', 'R');
        $this->ticket('R-P001', 'R', 'P');
        $priority = $this->ticket('ITMP-0001', 'ITM', 'P');

        Sanctum::actingAs($itm);
        $response = $this->postJson('/api/queue/call')->assertOk();
        $response->assertJsonPath('ticket.ticket_id', $priority->ticket_id)
            ->assertJsonPath('ticket.service_type', 'ITM')
            ->assertJsonPath('ticket.window', 1);
        $this->assertDatabaseHas('service_transactions', ['ticket_id' => $priority->ticket_id, 'staff_id' => $itm->user_id]);
    }

    public function test_two_staff_calls_cannot_claim_the_same_ticket(): void
    {
        $cashier = $this->staff('cashier', 'cashier1');
        $itm = $this->staff('itm', 'itm1');
        ServiceWindow::create(['department' => 'Cashier', 'window_number' => 1, 'service_type' => 'CS', 'service_scope' => 'cashier', 'staff_id' => $cashier->user_id]);
        $this->assignItmWindow($itm);
        $ticket = $this->ticket('C-R001', 'C');

        Sanctum::actingAs($cashier);
        $this->postJson('/api/queue/call')->assertOk()->assertJsonPath('ticket.ticket_id', $ticket->ticket_id);
        Sanctum::actingAs($itm);
        $this->postJson('/api/queue/call')->assertNotFound();
        $this->assertSame(1, ServiceTransaction::where('ticket_id', $ticket->ticket_id)->count());
    }

    public function test_itm_cannot_complete_another_departments_ticket(): void
    {
        $itm = $this->staff('itm', 'itm1');
        $this->assignItmWindow($itm);
        $ticket = $this->ticket('C-R001', 'C');
        Sanctum::actingAs($itm);
        $this->postJson('/api/queue/call')->assertNotFound();
        $this->putJson("/api/queue/{$ticket->ticket_id}/complete")->assertForbidden();
    }

    public function test_itm_normal_and_priority_numbers_increment_separately(): void
    {
        $this->assignItmWindow($this->staff('itm', 'itm-numbering'));
        User::create(['username' => 'guard', 'password' => 'password', 'full_name' => 'Guard', 'role' => 'security', 'status' => 'active', 'security_code' => '1234']);

        $this->postJson('/api/queue/generate', ['service_type' => 'ITM', 'priority_type' => 'R', 'transaction_type' => 'ITM Service'])
            ->assertCreated()->assertJsonPath('ticket.ticket_number', 'ITMN-0001');
        $this->postJson('/api/queue/generate', ['service_type' => 'ITM', 'priority_type' => 'P', 'security_code' => '1234', 'transaction_type' => 'ITM Service'])
            ->assertCreated()->assertJsonPath('ticket.ticket_number', 'ITMP-0001');
        $this->postJson('/api/queue/generate', ['service_type' => 'ITM', 'priority_type' => 'R', 'transaction_type' => 'ITM Service'])
            ->assertCreated()->assertJsonPath('ticket.ticket_number', 'ITMN-0002');
        $this->postJson('/api/queue/generate', ['service_type' => 'ITM', 'priority_type' => 'P', 'security_code' => '1234', 'transaction_type' => 'ITM Service'])
            ->assertCreated()->assertJsonPath('ticket.ticket_number', 'ITMP-0002');
    }
    public function test_two_normal_itm_tickets_count_call_complete_and_skip(): void
    {
        $itm = $this->staff('itm', 'itm');
        $this->assignItmWindow($itm);
        Sanctum::actingAs($itm);
        $this->getJson('/api/staff/queue/waiting')->assertOk()->assertJsonCount(0);
        $ids = [];
        foreach ([1, 2] as $number) {
            $response = $this->postJson('/api/queue/generate', [
                'service_type' => 'ITM', 'priority_type' => 'R', 'transaction_type' => 'ITM Service',
            ])->assertCreated()->assertJsonPath('ticket.ticket_number', 'ITMN-000'.$number)
                ->assertJsonPath('ticket.service_type', 'ITM')->assertJsonPath('ticket.status', 'waiting')
                ->assertJsonPath('ticket.window', null);
            $ids[] = $response->json('ticket.ticket_id');
            $this->getJson('/api/staff/queue/waiting')->assertOk()->assertJsonCount($number);
        }
        $this->getJson('/api/staff/current-window')->assertOk()->assertJsonPath('department', 'ITM')->assertJsonPath('window_number', 1);
        $this->postJson('/api/queue/call')->assertOk()->assertJsonPath('ticket.ticket_id', $ids[0])->assertJsonPath('transaction.staff_id', $itm->user_id);
        $this->getJson('/api/staff/queue/waiting')->assertJsonCount(1)->assertJsonPath('0.ticket_id', $ids[1]);
        $this->getJson('/api/staff/current-ticket')->assertJsonPath('ticket.ticket_id', $ids[0]);
        $this->putJson('/api/queue/'.$ids[0].'/complete')->assertOk()->assertJsonPath('ticket.status', 'done');
        $this->postJson('/api/queue/call')->assertOk()->assertJsonPath('ticket.ticket_id', $ids[1]);
        $this->getJson('/api/staff/queue/waiting')->assertJsonCount(0);
        $this->putJson('/api/queue/'.$ids[1].'/cancel')->assertOk()->assertJsonPath('ticket.status', 'cancelled');
        $this->getJson('/api/staff/current-ticket')->assertJsonPath('ticket', null);
    }

    public function test_itm_priority_and_normal_tickets_are_invisible_to_other_departments(): void
    {
        $itm = $this->staff('itm', 'itm');
        $this->assignItmWindow($itm);
        $cashier = $this->staff('cashier', 'cashier1');
        $registrar = $this->staff('registrar', 'registrar1');
        ServiceWindow::create(['department'=>'registrar','window_number'=>9,'staff_id'=>$registrar->user_id,'service_type'=>'RT','service_scope'=>'department']);
        $normal = $this->ticket('ITMN-0001', 'ITM');
        $priority = $this->ticket('ITMP-0001', 'ITM', 'P');
        foreach ([$cashier, $registrar] as $staff) {
            Sanctum::actingAs($staff);
            $this->getJson('/api/staff/queue/waiting?mode=itm')->assertJsonCount(0);
            $this->postJson('/api/queue/call', ['service_type'=>'ITM'])->assertNotFound();
        }
        $this->ticket('C-R001', 'C');
        $registrarTicket = $this->ticket('R-R001', 'R');
        $registrarTicket->update(['window'=>9]);
        Sanctum::actingAs($itm);
        $this->getJson('/api/staff/queue/waiting')->assertJsonCount(2)->assertJsonPath('0.ticket_id', $priority->ticket_id)->assertJsonPath('1.ticket_id', $normal->ticket_id);
        $this->postJson('/api/queue/call')->assertOk()->assertJsonPath('ticket.ticket_id', $priority->ticket_id);
        foreach ([$cashier, $registrar] as $staff) {
            Sanctum::actingAs($staff);
            $this->getJson('/api/staff/current-ticket')->assertJsonPath('ticket', null);
            foreach (['complete', 'cancel'] as $action) $this->putJson('/api/queue/'.$priority->ticket_id.'/'.$action)->assertForbidden();
        }
    }
}
