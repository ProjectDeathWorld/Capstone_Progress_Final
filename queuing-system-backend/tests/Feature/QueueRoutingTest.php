<?php
namespace Tests\Feature;

use App\Models\{User, QueueTicket, ServiceWindow, ServiceTransaction};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QueueRoutingTest extends TestCase
{
    use RefreshDatabase;

    private function staff(string $department, int $number): User
    {
        $staff = User::create(['username' => $department.$number, 'password' => 'password', 'full_name' => $department.$number, 'role' => 'staff', 'position' => $department, 'status' => 'active']);
        ServiceWindow::create(['department' => $department, 'window_number' => $number, 'staff_id' => $staff->user_id, 'service_type' => $department === 'cashier' ? 'CS' : 'RT', 'service_scope' => 'department', 'status' => 'open', 'is_available' => true]);
        return $staff;
    }

    public function test_shared_cashier_queue_priority_claims_and_individual_restoration(): void
    {
        $staff = array_map(fn ($n) => $this->staff('cashier', $n), [1, 2, 3]);
        User::create(['username'=>'guard','password'=>'password','full_name'=>'Guard','role'=>'security','status'=>'active','security_code'=>'1234']);
        foreach (['R', 'P', 'R'] as $priority) {
            $this->postJson('/api/queue/generate', ['service_type'=>'C','priority_type'=>$priority,'security_code'=>'1234','window'=>9])->assertCreated()->assertJsonPath('ticket.window', null);
        }
        foreach ($staff as $user) {
            Sanctum::actingAs($user);
            $this->getJson('/api/staff/queue/waiting')->assertOk()->assertJsonCount(3);
            $this->getJson('/api/staff/current-ticket')->assertJsonPath('ticket', null);
        }
        $ids=[];
        foreach ($staff as $i => $user) {
            Sanctum::actingAs($user);
            $call=$this->postJson('/api/queue/call', ['service_type'=>'R','window'=>13])->assertOk()->assertJsonPath('ticket.service_type','C')->assertJsonPath('ticket.window',$i+1)->assertJsonPath('transaction.staff_id',$user->user_id);
            if ($i===0) $call->assertJsonPath('ticket.priority_type','P');
            $ids[]=$call->json('ticket.ticket_id');
            $this->getJson('/api/staff/queue/waiting')->assertJsonCount(2-$i);
            $this->postJson('/api/queue/call')->assertJsonPath('ticket.ticket_id',$ids[$i])->assertJsonPath('already_active',true);
        }
        $this->assertCount(3,array_unique($ids));
        Sanctum::actingAs($this->staff('registrar', 9));
        $this->getJson('/api/staff/current-ticket')->assertJsonPath('ticket', null);
        foreach (['complete','cancel'] as $action) $this->putJson('/api/queue/'.$ids[0].'/'.$action)->assertForbidden();
        foreach ($staff as $i => $user) {
            Sanctum::actingAs($user);
            foreach (['full','mini'] as $view) $this->getJson('/api/staff/current-ticket?view='.$view)->assertJsonPath('ticket.ticket_id',$ids[$i]);
            foreach (['complete','cancel'] as $action) $this->putJson('/api/queue/'.$ids[($i+1)%3].'/'.$action)->assertForbidden();
        }
    }

    public function test_registrar_windows_and_departments_are_isolated(): void
    {
        $cashiers=array_map(fn($n)=>$this->staff('cashier',$n),[1,2,3]);
        $registrars=array_map(fn($n)=>$this->staff('registrar',$n),[9,10,11,12,13]);
        foreach ([9,13] as $window) {
            // Guest is the existing authorized manual Registrar fallback.
            $id=$this->postJson('/api/queue/generate',['service_type'=>'R','student_number'=>'Guest','window'=>$window])->assertCreated()->json('ticket.ticket_id');
            foreach (array_merge($cashiers,$registrars) as $user) {
                Sanctum::actingAs($user);
                $owns=$user->username==='registrar'.$window;
                $this->getJson('/api/staff/queue/waiting')->assertJsonCount($owns?1:0);
                if (!$owns) $this->postJson('/api/queue/call')->assertStatus($user->username==='registrar9' && $window===13 ? 200 : 404);
            }
            Sanctum::actingAs($registrars[$window-9]);
            $this->postJson('/api/queue/call')->assertOk()->assertJsonPath('ticket.ticket_id',$id);
            foreach ($cashiers as $cashier) {
                Sanctum::actingAs($cashier);
                $this->getJson('/api/staff/current-ticket')->assertJsonPath('ticket',null);
                foreach (['complete','cancel'] as $action) $this->putJson('/api/queue/'.$id.'/'.$action)->assertForbidden();
            }
            Sanctum::actingAs($registrars[$window-9]);
            $this->getJson('/api/staff/current-ticket')->assertJsonPath('ticket.ticket_id',$id);
        }
    }

    public function test_wrong_department_and_wrong_window_transactions_are_not_restored(): void
    {
        $cashier=$this->staff('cashier',1);
        $registrar=$this->staff('registrar',9);
        $ticket=QueueTicket::create(['ticket_number'=>'R-R003','service_type'=>'R','priority_type'=>'R','status'=>'serving','window'=>13,'created_at'=>now()]);
        foreach ([$cashier,$registrar] as $staff) {
            ServiceTransaction::create(['ticket_id'=>$ticket->ticket_id,'staff_id'=>$staff->user_id,'start_time'=>now()]);
            Sanctum::actingAs($staff);
            $this->getJson('/api/staff/current-ticket')->assertJsonPath('ticket',null);
            $this->postJson('/api/queue/call')->assertNotFound();
            foreach (['complete','cancel'] as $action) $this->putJson('/api/queue/'.$ticket->ticket_id.'/'.$action)->assertForbidden();
        }
    }
}
