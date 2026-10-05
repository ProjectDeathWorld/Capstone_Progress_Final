<?php
namespace Tests\Feature;

use App\Models\{QueueTicket, User, ServiceWindow, ServiceTransaction, ServiceLog};
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QueueVolumeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-09-18 11:30:00', 'UTC'));
        Sanctum::actingAs(User::create(['username'=>'admin-volume','password'=>'password','full_name'=>'Admin','role'=>'admin','status'=>'active']));
    }
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }
    private function ticket(string $number, string $localTime, string $status='waiting'): QueueTicket
    {
        $type=explode('-', $number)[0];
        return QueueTicket::create(['ticket_number'=>$number,'service_type'=>$type,'priority_type'=>str_contains($number,'-P')?'P':'R','status'=>$status,'created_at'=>Carbon::parse($localTime,'Asia/Manila')->utc()]);
    }
    private function counts(): array
    {
        return $this->getJson('/api/analytics/peak-hours?period=today')->assertOk()->assertJsonPath('timezone','Asia/Manila')->json('distribution');
    }
    public function test_empty_day_and_exact_hourly_fixture_across_departments_and_statuses(): void
    {
        $this->assertSame(array_fill(0,13,0),array_column($this->counts(),'count'));
        foreach ([['C-R001','07:15:00','waiting'],['R-R001','07:46:00','serving'],['C-P001','08:03:00','done'],['R-P001','08:20:00','cancelled'],['ITM-N001','08:58:00','waiting'],['C-R002','10:11:00','done']] as [$number,$time,$status]) $this->ticket($number,'2026-09-18 '.$time,$status);
        $this->ticket('C-R003','2026-09-17 08:00:00');
        $this->ticket('C-R004','2026-09-19 08:00:00');
        $this->ticket('C-R005','2026-09-18 19:45:00'); // Future today, excluded.
        $distribution=$this->counts();
        $this->assertSame([2,3,0,1,0,0,0,0,0,0,0,0,0],array_column($distribution,'count'));
        $this->assertSame(range(7,19),array_column($distribution,'hour'));
        $this->assertSame($distribution,$this->counts()); // Refresh reconstructs identical values.
        $this->getJson('/api/analytics/peak-hours?department=ITM')->assertOk()->assertJsonPath('total_tickets',1)->assertJsonPath('distribution.1.count',1);
        QueueTicket::query()->delete();
        $this->assertSame(array_fill(0,13,0),array_column($this->counts(),'count'));
    }
    public function test_kiosk_generation_counts_once_and_survives_complete_skip_and_related_records(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-18 09:04:00','UTC')); // 5:04 PM Manila.
        $staff=User::create(['username'=>'cashier1','password'=>'password','full_name'=>'Cashier','role'=>'staff','position'=>'cashier','status'=>'active']);
        User::create(['username'=>'guard-volume','password'=>'password','full_name'=>'Guard','role'=>'security','status'=>'active','security_code'=>'1234']);
        ServiceWindow::create(['department'=>'registrar','window_number'=>9,'service_type'=>'RT','status'=>'open','is_available'=>true]);
        \App\Models\DisplaySetting::create(['settings' => ['enabledDepartments' => ['Cashier', 'Registrar', 'ITM']]]);
        $itm = User::create(['username'=>'itm-volume','password'=>'password','full_name'=>'ITM','role'=>'staff','position'=>'itm','status'=>'active']);
        ServiceWindow::where('department', 'ITM')->update(['staff_id'=>$itm->user_id, 'status'=>'open', 'is_available'=>true]);
        foreach ([['C','R'],['R','R'],['ITM','R'],['C','P']] as $i=>[$service,$priority]) {
            $this->postJson('/api/queue/generate',['service_type'=>$service,'priority_type'=>$priority,'student_number'=>$service==='R'?'Guest':null,'window'=>$service==='R'?9:null,'security_code'=>'1234'])->assertCreated();
            $counts=array_column($this->counts(),'count');
            $this->assertSame($i+1,$counts[10]);
            $this->assertSame($i+1,array_sum($counts));
        }
        Sanctum::actingAs($staff);
        $id=$this->postJson('/api/queue/call')->assertOk()->json('ticket.ticket_id');
        $this->putJson('/api/queue/'.$id.'/complete')->assertOk();
        $id2=$this->postJson('/api/queue/call')->assertOk()->json('ticket.ticket_id');
        $this->putJson('/api/queue/'.$id2.'/cancel')->assertOk();
        ServiceTransaction::create(['ticket_id'=>$id,'staff_id'=>$staff->user_id,'start_time'=>now(),'end_time'=>now()]);
        ServiceLog::create(['user_id'=>$staff->user_id,'action'=>'Additional history for volume regression','created_at'=>now()]);
        $this->assertSame(4,$this->counts()[10]['count']);
    }
    public function test_local_today_crosses_utc_midnight_and_excludes_future_records(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-17 23:30:00','UTC')); // September 18, 7:30 AM.
        $this->ticket('ITM-N001','2026-09-18 07:00:00');
        $this->ticket('ITM-N002','2026-09-17 07:15:00');
        $this->ticket('ITM-N003','2026-09-18 07:31:00');
        $this->getJson('/api/analytics/peak-hours?period=today')->assertOk()->assertJsonPath('date_range.start','2026-09-18 00:00:00')->assertJsonPath('date_range.end','2026-09-18 23:59:59')->assertJsonPath('distribution.0.count',1)->assertJsonPath('total_tickets',1);
    }
}
