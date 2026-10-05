<?php
namespace Tests\Feature;

use App\Models\QueueTicket;
use App\Models\ServiceWindow;
use App\Models\User;
use App\Models\ServiceTransaction;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QueueReportTest extends TestCase
{
    use RefreshDatabase;

    private function ticket($number, $type, $created, $status = 'completed', $called = null, $completed = null, $student = null) {
        return QueueTicket::create(['ticket_number' => $number, 'service_type' => $type, 'created_at' => $created,
            'status' => $status, 'priority_type' => 'R', 'called_at' => $called, 'completed_at' => $completed,
            'student_number' => $student, 'transaction_type' => 'Database transaction label', 'window' => 2]);
    }

    public function test_reports_isolate_departments_boundaries_and_reconcile_every_series(): void {
        $this->ticket('ITM-N001', 'ITM', '2026-09-01 00:00:00', 'completed', '2026-09-01 00:04:00', '2026-09-01 00:10:00', '2026-001');
        $this->ticket('ITM-N002', 'ITM', '2026-09-07 23:59:59', 'waiting');
        $this->ticket('ITM-N003', 'ITM', '2026-09-08 00:00:00', 'waiting');
        $this->ticket('C-N001', 'C', '2026-09-02 09:00:00', 'waiting');
        $r = $this->getJson('/api/reports?period=custom&start_date=2026-09-01&end_date=2026-09-07&department=ITM')
            ->assertOk()->assertJsonPath('report_summary.tickets_issued', 2)->assertJsonPath('report_summary.completed', 1)
            ->assertJsonPath('report_summary.students_served', 1)->assertJsonPath('report_summary.average_waiting_time', 4)
            ->assertJsonPath('report_summary.average_service_time', 6)->assertJsonPath('report_summary.completion_rate', 50)->json();
        if (getenv('REPORT_QA_OUTPUT')) file_put_contents(getenv('REPORT_QA_OUTPUT'), json_encode($r));
        $this->assertEquals(2, array_sum(array_column($r['charts']['statuses'], 'value')));
        $this->assertEquals(2, array_sum(array_column($r['charts']['hourly'], 'value')));
        $this->assertEquals(2, array_sum(array_column($r['charts']['visitors'], 'value')));
        $this->assertEquals(1, array_sum(array_column($r['charts']['daily'], 'completed')));
        $this->assertEquals(1, array_sum(array_column($r['charts']['transactions'], 'value')));
        $this->assertSame($r['report_summary']['average_waiting_time'], $r['analytics']['dashboard']['average_waiting_time']);
    }

    public function test_invalid_durations_are_excluded_and_staff_uses_history(): void {
        $staff = User::create(['username' => 'actual-staff', 'password' => 'password', 'full_name' => 'Actual Historical Staff', 'role' => 'staff', 'position' => 'cashier', 'status' => 'active']);
        $ticket = $this->ticket('C-N001', 'C', '2026-09-01 09:00:00', 'completed', '2026-09-01 09:04:00', '2026-09-01 09:10:00');
        ServiceTransaction::create(['ticket_id' => $ticket->ticket_id, 'staff_id' => $staff->user_id, 'start_time' => $ticket->called_at, 'end_time' => $ticket->completed_at]);
        $this->ticket('C-N002', 'C', '2026-09-01 10:00:00', 'completed', '2026-09-01 09:59:00', '2026-09-01 09:58:00');
        $this->getJson('/api/reports?period=custom&start_date=2026-09-01&end_date=2026-09-01&department=Cashier')
            ->assertOk()->assertJsonPath('report_summary.completed', 2)->assertJsonPath('report_summary.average_waiting_time', 4)
            ->assertJsonPath('report_summary.average_service_time', 6)->assertJsonPath('report_summary.excluded_waiting_samples', 1)
            ->assertJsonPath('staff_summary.0.staff_name', 'Actual Historical Staff')->assertJsonPath('staff_summary.0.window', 'Window 2')
            ->assertJsonPath('staff_summary.0.tickets_served', 1);
    }

    public function test_staff_summary_uses_assigned_window_order_and_excludes_unassigned_staff(): void {
        $staff = collect([
            ['username' => 'cashier1', 'full_name' => 'Cashier Staff 1', 'position' => 'cashier', 'department' => 'Cashier', 'window' => 1],
            ['username' => 'cashier2', 'full_name' => 'Cashier Staff 2', 'position' => 'cashier', 'department' => 'Cashier', 'window' => 2],
            ['username' => 'cashier3', 'full_name' => 'Cashier Staff 3', 'position' => 'cashier', 'department' => 'Cashier', 'window' => 3],
            ['username' => 'registrar1', 'full_name' => 'Registrar Staff 1', 'position' => 'registrar', 'department' => 'Registrar', 'window' => 9],
            ['username' => 'registrar2', 'full_name' => 'Registrar Staff 2', 'position' => 'registrar', 'department' => 'Registrar', 'window' => 10],
            ['username' => 'registrar3', 'full_name' => 'Registrar Staff 3', 'position' => 'registrar', 'department' => 'Registrar', 'window' => 11],
            ['username' => 'registrar4', 'full_name' => 'Registrar Staff 4', 'position' => 'registrar', 'department' => 'Registrar', 'window' => 12],
            ['username' => 'registrar5', 'full_name' => 'Registrar Staff 5', 'position' => 'registrar', 'department' => 'Registrar', 'window' => 13],
            ['username' => 'registrar6', 'full_name' => 'Registrar Staff 6', 'position' => 'registrar', 'department' => 'Registrar', 'window' => null],
        ])->map(function (array $attributes) {
            $user = User::create([
                'username' => $attributes['username'],
                'password' => 'password',
                'full_name' => $attributes['full_name'],
                'role' => 'staff',
                'position' => $attributes['position'],
                'status' => 'active',
            ]);

            if ($attributes['window'] !== null) {
                ServiceWindow::create([
                    'department' => $attributes['department'],
                    'window_number' => $attributes['window'],
                    'service_type' => $attributes['position'] === 'cashier' ? 'CS' : 'RT',
                    'service_scope' => 'department',
                    'is_available' => true,
                    'status' => 'open',
                    'staff_id' => $user->user_id,
                ]);
            }

            return $user;
        });

        $cashierTwoTicket = $this->ticket(
            'C-N001',
            'C',
            '2026-09-01 09:00:00',
            'completed',
            '2026-09-01 09:04:00',
            '2026-09-01 09:10:00',
            '2026-001'
        );
        $cashierTwoTicket->update(['window' => 2]);
        ServiceTransaction::create([
            'ticket_id' => $cashierTwoTicket->ticket_id,
            'staff_id' => $staff->firstWhere('username', 'cashier2')->user_id,
        ]);

        $registrarThreeTicket = $this->ticket(
            'R-R001',
            'R',
            '2026-09-01 10:00:00',
            'completed',
            '2026-09-01 10:05:00',
            '2026-09-01 10:12:00',
            '2026-002'
        );
        $registrarThreeTicket->update(['window' => 3]);
        ServiceTransaction::create([
            'ticket_id' => $registrarThreeTicket->ticket_id,
            'staff_id' => $staff->firstWhere('username', 'registrar3')->user_id,
        ]);

        $response = $this->getJson('/api/reports?period=custom&start_date=2026-09-01&end_date=2026-09-01&department=all')
            ->assertOk()
            ->json('staff_summary');

        $this->assertSame([
            'Cashier Staff 1',
            'Cashier Staff 2',
            'Cashier Staff 3',
            'Registrar Staff 1',
            'Registrar Staff 2',
            'Registrar Staff 3',
            'Registrar Staff 4',
            'Registrar Staff 5',
        ], array_column($response, 'staff_name'));
        $this->assertSame([
            'Window 1',
            'Window 2',
            'Window 3',
            'Window 9',
            'Window 10',
            'Window 11',
            'Window 12',
            'Window 13',
        ], array_column($response, 'window'));

        $byName = collect($response)->keyBy('staff_name');
        $this->assertSame(1, $byName['Cashier Staff 2']['tickets_served']);
        $this->assertSame(1, $byName['Registrar Staff 3']['tickets_served']);
        $this->assertSame(0, $byName['Registrar Staff 2']['tickets_served']);
        $this->assertSame(0, $byName['Registrar Staff 5']['tickets_served']);
        $this->assertArrayNotHasKey('Registrar Staff 6', $byName);
    }

    public function test_staff_summary_adds_database_itm_staff_last_with_owned_period_metrics(): void {
        $itm = User::create([
            'username' => 'actual-itm',
            'password' => 'password',
            'full_name' => 'Actual ITM Operator',
            'role' => 'staff',
            'position' => 'itm',
            'status' => 'active',
        ]);
        $itmWindow = ServiceWindow::firstOrCreate(
            ['department' => 'ITM', 'window_number' => 1],
            [
                'service_type' => 'ITM',
                'service_scope' => 'department',
                'is_available' => true,
                'status' => 'open',
            ]
        );
        $itmWindow->update(['staff_id' => $itm->user_id]);

        $itmTicket = $this->ticket(
            'R-R010',
            'R',
            '2026-09-01 11:00:00',
            'completed',
            '2026-09-01 11:03:00',
            '2026-09-01 11:09:00',
            '2026-010'
        );
        $itmTicket->update(['window' => 4]);
        ServiceTransaction::create([
            'ticket_id' => $itmTicket->ticket_id,
            'staff_id' => $itm->user_id,
        ]);

        $response = $this->getJson('/api/reports?period=custom&start_date=2026-09-01&end_date=2026-09-01&department=all')
            ->assertOk()
            ->json('staff_summary');

        $this->assertSame('Actual ITM Operator', end($response)['staff_name']);
        $this->assertSame('ITM', end($response)['department']);
        $this->assertSame('Window 12', end($response)['window']);
        $this->assertSame(1, end($response)['tickets_served']);
        $this->assertSame(3, end($response)['average_waiting_time']);
        $this->assertSame(6, end($response)['average_service_time']);
        $this->assertSame(100, end($response)['completion_rate']);

        $outsidePeriod = $this->ticket(
            'R-R011',
            'R',
            '2026-09-02 11:00:00',
            'completed',
            '2026-09-02 11:03:00',
            '2026-09-02 11:09:00',
            '2026-011'
        );
        ServiceTransaction::create(['ticket_id' => $outsidePeriod->ticket_id, 'staff_id' => $itm->user_id]);

        $samePeriod = $this->getJson('/api/reports?period=custom&start_date=2026-09-01&end_date=2026-09-01&department=all')
            ->assertOk()
            ->json('staff_summary');
        $this->assertSame(1, end($samePeriod)['tickets_served']);
    }

    public function test_zero_transaction_itm_staff_is_included_without_fabricating_a_window(): void {
        $itm = User::create([
            'username' => 'itm-no-window',
            'password' => 'password',
            'full_name' => 'ITM Without Assignment',
            'role' => 'staff',
            'position' => 'itm',
            'status' => 'active',
        ]);

        $response = $this->getJson('/api/reports?period=custom&start_date=2026-09-01&end_date=2026-09-01&department=all')
            ->assertOk()
            ->json('staff_summary');
        $row = collect($response)->firstWhere('staff_id', $itm->user_id);

        $this->assertNotNull($row);
        $this->assertSame('ITM Without Assignment', $row['staff_name']);
        $this->assertSame('Unassigned', $row['window']);
        $this->assertSame(0, $row['tickets_served']);
        $this->assertSame(0, $row['average_waiting_time']);
        $this->assertSame(0, $row['average_service_time']);
        $this->assertSame(0, $row['completion_rate']);
    }

    public function test_periods_use_rolling_ranges_and_invalid_ranges_return_validation_error(): void {
        Carbon::setTestNow('2026-09-08 12:00:00');
        try {
            foreach (['today' => '2026-09-08', 'weekly' => '2026-09-02', 'monthly' => '2026-08-10', 'semester' => '2026-03-08'] as $period => $start) {
                foreach (['Cashier', 'Registrar', 'ITM', 'all'] as $department) {
                    $this->getJson("/api/reports?period=$period&department=$department")->assertOk()
                        ->assertJsonPath('date_range.start', "$start 00:00:00")->assertJsonPath('report_summary.tickets_issued', 0)
                        ->assertJsonPath('report_summary.average_service_time', null);
                }
            }
            $this->getJson('/api/reports?period=custom&start_date=2026-09-08&end_date=2026-09-01')->assertUnprocessable();
            $this->getJson('/api/reports?period=custom&start_date=nonsense')->assertUnprocessable();
        } finally { Carbon::setTestNow(); }
    }
    public function test_large_report_keeps_all_transaction_labels_and_staff_window_rows(): void {
        for ($i = 0; $i < 35; $i++) {
            $staff = User::create(['username' => 'history-'.$i, 'password' => 'password',
                'full_name' => 'Historical Staff With A Long Full Name '.$i, 'role' => 'staff', 'position' => 'registrar', 'status' => 'active']);
            $created = Carbon::parse('2026-09-01')->addHours($i);
            $ticket = $this->ticket('R-R'.str_pad($i + 1, 3, '0', STR_PAD_LEFT), 'R', $created,
                'completed', $created->copy()->addMinutes(4), $created->copy()->addMinutes(10));
            $ticket->update(['transaction_type' => 'Long configured transaction description number '.($i % 12), 'window' => 1 + ($i % 5)]);
            ServiceTransaction::create(['ticket_id' => $ticket->ticket_id, 'staff_id' => $staff->user_id]);
        }
        $r = $this->getJson('/api/reports?period=custom&start_date=2026-09-01&end_date=2026-09-07&department=Registrar')
            ->assertOk()->assertJsonPath('report_summary.completed', 35)->assertJsonCount(35, 'staff_summary')->assertJsonCount(12, 'charts.transactions')->json();
        if (getenv('REPORT_QA_OUTPUT')) file_put_contents(getenv('REPORT_QA_OUTPUT').'.stress.json', json_encode($r));
        $empty = $this->getJson('/api/reports?period=custom&start_date=2000-01-01&end_date=2000-01-01')->assertOk()->json();
        if (getenv('REPORT_QA_OUTPUT')) file_put_contents(getenv('REPORT_QA_OUTPUT').'.empty.json', json_encode($empty));
    }

}
