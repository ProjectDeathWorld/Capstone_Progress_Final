<?php
namespace Tests\Feature;

use App\Models\QueueTicket;
use App\Models\ServiceWindow;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WindowUtilizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-09-06 12:00:00');
        Sanctum::actingAs(User::create(['username'=>'util-admin','password'=>'password','full_name'=>'Admin','role'=>'admin','status'=>'active']));
        ServiceWindow::query()->delete();
        foreach (['Cashier'=>[1,2,3], 'Registrar'=>[9,10,11,12,13]] as $department=>$numbers) {
            foreach ($numbers as $number) ServiceWindow::create([
                'department'=>$department,'window_number'=>$number,'service_type'=>$department === 'Cashier' ? 'CS' : 'RT',
                'is_available'=>true,'status'=>'open',
            ]);
        }
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function ticket(string $type, ?int $window, ?string $called, ?string $completed, string $status = 'done', ?string $created = null): QueueTicket
    {
        return QueueTicket::create([
            'ticket_number'=>'T-'.(QueueTicket::count()+1), 'service_type'=>$type,'window'=>$window,
            'priority_type'=>'R','status'=>$status,'created_at'=>$created ?? '2026-09-06 08:00:00',
            'called_at'=>$called,'completed_at'=>$completed,
        ]);
    }

    private function rows(string $department = 'Cashier', string $period = 'today'): array
    {
        return collect($this->getJson('/api/analytics/department-comparison?department='.$department.'&period='.$period)
            ->assertOk()->json())->pluck('window_utilization')->filter()->values()->all();
    }

    public function test_valid_services_are_aggregated_once_and_invalid_durations_are_excluded(): void
    {
        $ticket = $this->ticket('C',1,'2026-09-06 09:00:00','2026-09-06 09:05:00');
        $this->ticket('C',1,'2026-09-06 09:10:00','2026-09-06 09:18:00');
        $this->ticket('C',1,'2026-09-06 09:20:00','2026-09-06 09:27:00');
        $this->ticket('C',1,'2026-09-06 10:00:00','2026-09-06 09:59:00');
        $this->ticket('C',1,null,'2026-09-06 09:59:00');
        $this->ticket('C',1,'2026-09-06 09:00:00',null,'serving');
        $this->ticket('C',1,null,null,'waiting');
        $this->ticket('C',1,'2026-09-06 09:00:00','2026-09-06 09:01:00','cancelled');
        $this->ticket('C',2,'2026-09-06 09:00:00','2026-09-06 09:10:00');
        $this->ticket('R',9,'2026-09-06 09:00:00','2026-09-06 09:30:00');
        $this->ticket('ITM',1,'2026-09-06 09:00:00','2026-09-06 09:40:00');
        // Duplicate transaction rows cannot multiply ticket-level statistics.
        foreach ([1,2] as $unused) \App\Models\ServiceTransaction::create([
            'ticket_id'=>$ticket->ticket_id,'staff_id'=>auth()->id(),
            'start_time'=>'2026-09-06 09:00:00','end_time'=>'2026-09-06 09:05:00',
        ]);
        $rows = $this->rows();
        $this->assertCount(3,$rows);
        $this->assertSame(4,$rows[0]['tickets_handled']);
        $this->assertSame(3,$rows[0]['valid_service_tickets']);
        $this->assertSame(2,$rows[0]['invalid_duration_tickets']);
        $this->assertEquals(20,$rows[0]['active_minutes']);
        $this->assertEquals(6.67,$rows[0]['avg_service_minutes']);
        $this->assertNull($rows[0]['idle_minutes']);
        $this->assertNull($rows[0]['utilization_rate']);
        $this->assertEquals(10,$rows[1]['active_minutes']);
        $this->assertSame(0,$rows[2]['tickets_handled']);
        $this->assertEquals(0,$rows[2]['active_minutes']);
        $this->assertEquals(0,$rows[2]['avg_service_minutes']);
    }

    public function test_registrar_association_and_completion_date_match_students_served(): void
    {
        $this->ticket('R',12,'2026-09-05 23:55:00','2026-09-06 00:05:00','done','2026-09-05 23:00:00');
        $this->ticket('R',1,'2026-09-06 09:00:00','2026-09-06 09:01:00'); // Legacy Window 9.
        $this->ticket('R',13,'2026-09-05 09:00:00','2026-09-05 09:01:00','done','2026-09-05 08:00:00');
        $rows = $this->rows('Registrar');
        $this->assertSame([9,10,11,12,13],array_column($rows,'window_number'));
        $this->assertSame(1,$rows[0]['tickets_handled']);
        $this->assertSame(1,$rows[3]['tickets_handled']);
        $this->assertEquals(10,$rows[3]['active_minutes']);
        $this->assertSame(0,$rows[4]['tickets_handled']);
        $served = $this->getJson('/api/analytics/customers-served?department=Registrar&period=today')->assertOk()->json('total_customers_served');
        $this->assertEquals($served,array_sum(array_column($rows,'tickets_handled')));
    }

    public function test_rolling_and_custom_ranges_and_unknown_windows(): void
    {
        foreach ([0,6,7,29,30,100,200] as $days) {
            $date = now()->subDays($days)->format('Y-m-d');
            $this->ticket('C',1,"$date 09:00:00","$date 09:05:00",'done',"$date 08:00:00");
        }
        foreach (['today'=>1,'week'=>2,'month'=>4,'semester'=>6,'custom&start_date=2026-08-30&end_date=2026-08-30'=>1] as $period=>$count) {
            $this->assertSame($count,$this->rows('Cashier',$period)[0]['tickets_handled']);
            $this->getJson('/api/analytics/customers-served?department=Cashier&period='.$period)->assertOk()->assertJsonPath('total_customers_served',$count);
        }
        $this->ticket('C',null,'2026-09-06 09:00:00','2026-09-06 09:10:00');
        $this->ticket('C',5,'2026-09-06 09:00:00','2026-09-06 09:10:00');
        $this->assertSame(1,$this->rows()[0]['tickets_handled']); // Do not invent Window 1 assignments.
    }
}
