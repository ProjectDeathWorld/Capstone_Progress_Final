<?php

namespace Tests\Feature;

use App\Models\QueueTicket;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TransactionAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $admin = User::create([
            'username' => 'analytics-admin',
            'password' => 'password',
            'full_name' => 'Analytics Admin',
            'role' => 'admin',
            'status' => 'active',
        ]);
        Sanctum::actingAs($admin);
    }

    public function test_office_comparison_keeps_empty_itm_and_isolates_its_counts_and_durations(): void
    {
        $url = '/api/analytics/department-comparison?period=today';
        $this->completedTicket('C-R001', 'C', 'Payment');
        $this->completedTicket('R-R001', 'R', 'Document Request');
        $before = $this->getJson($url)->assertOk()->assertJsonCount(4)
            ->assertJsonPath('2.department', 'ITM')
            ->assertJsonPath('2.waiting', 0)
            ->assertJsonPath('2.customers_served', 0)
            ->assertJsonPath('2.average_waiting_time', 0)
            ->assertJsonPath('2.average_service_time', 0)->json();

        $created = now()->startOfDay()->addHours(1);
        $normal = QueueTicket::create([
            'ticket_number' => 'ITM-N001', 'service_type' => 'ITM',
            'priority_type' => 'R', 'status' => 'waiting', 'created_at' => $created,
        ]);
        QueueTicket::create([
            'ticket_number' => 'ITM-P001', 'service_type' => 'ITM',
            'priority_type' => 'P', 'status' => 'waiting', 'created_at' => $created,
        ]);
        $this->getJson($url)->assertOk()->assertJsonPath('2.waiting', 2);
        $normal->update([
            'status' => 'completed', 'called_at' => $created->copy()->addMinutes(4),
            'completed_at' => $created->copy()->addMinutes(10),
        ]);
        $after = $this->getJson($url)->assertOk()
            ->assertJsonPath('2.waiting', 1)->assertJsonPath('2.customers_served', 1)
            ->assertJsonPath('2.average_waiting_time', 4)
            ->assertJsonPath('2.average_service_time', 6)->json();
        $this->assertSame($before[0], $after[0]);
        $this->assertSame($before[1], $after[1]);
        $this->getJson('/api/analytics/department-comparison?period=custom&start_date=2000-01-01&end_date=2000-01-01')
            ->assertOk()->assertJsonPath('2.waiting', 0)->assertJsonPath('2.customers_served', 0);
    }

    public function test_cashier_and_registrar_transaction_counts_are_separate(): void
    {
        $this->completedTicket('C-R001', 'C', 'Payment');
        $this->completedTicket('C-R002', 'C', 'Payment');
        $this->completedTicket('C-R003', 'C', 'Clearance');
        $this->completedTicket('R-R001', 'R', 'Document Request');
        $this->completedTicket('R-R002', 'R', 'Clearance');
        $this->completedTicket('R-R003', 'R', 'Clearance');
        $this->completedTicket('R-R004', 'R', 'Others');

        $cashier = $this->getJson('/api/analytics/transactions?department=Cashier&period=today')
            ->assertOk()
            ->assertJsonPath('department', 'cashier')
            ->assertJsonPath('total_transactions', 3)
            ->assertJsonPath('most_used_transaction.type', 'Payment')
            ->assertJsonPath('most_used_transaction.count', 2)
            ->assertJsonPath('transactions.0.type', 'Payment')
            ->assertJsonPath('transactions.0.percentage', 66.67)
            ->json();

        $registrar = $this->getJson('/api/analytics/transactions?department=Registrar&period=today')
            ->assertOk()
            ->assertJsonPath('department', 'registrar')
            ->assertJsonPath('total_transactions', 4)
            ->assertJsonPath('most_used_transaction.type', 'Clearance')
            ->assertJsonPath('most_used_transaction.count', 2)
            ->json();

        $this->assertSame(1, collect($cashier['transactions'])->firstWhere('type', 'Clearance')['count']);
        $this->assertSame(2, collect($registrar['transactions'])->firstWhere('type', 'Clearance')['count']);
        $this->assertSame(0, collect($cashier['transactions'])->firstWhere('type', 'Others')['count']);
        $this->assertSame(1, collect($registrar['transactions'])->firstWhere('type', 'Others')['count']);
    }

    public function test_ticket_generation_persists_the_selected_transaction_type(): void
    {
        $this->postJson('/api/queue/generate', [
            'service_type' => 'CS',
            'priority_type' => 'R',
            'transaction_type' => 'Payment',
        ])
            ->assertCreated()
            ->assertJsonPath('ticket.transaction_type', 'Payment');

        $this->assertDatabaseHas('queue_tickets', [
            'service_type' => 'C',
            'transaction_type' => 'Payment',
        ]);
    }

    public function test_all_supported_date_filters_use_completed_transaction_dates(): void
    {
        Carbon::setTestNow('2026-08-27 12:00:00');

        try {
            $this->completedTicket('C-R010', 'C', 'Payment', Carbon::now());
            $this->completedTicket('C-R011', 'C', 'Payment', Carbon::now()->subDays(5));
            $this->completedTicket('C-R012', 'C', 'Payment', Carbon::now()->subDays(20));
            $this->completedTicket('C-R013', 'C', 'Payment', Carbon::now()->subDays(100));
            $this->completedTicket('C-R014', 'C', 'Payment', Carbon::now()->subDays(200));

            $this->getJson('/api/analytics/transactions?department=Cashier&period=today')
                ->assertJsonPath('total_transactions', 1);
            $this->getJson('/api/analytics/transactions?department=Cashier&period=weekly')
                ->assertJsonPath('total_transactions', 2);
            $this->getJson('/api/analytics/transactions?department=Cashier&period=monthly')
                ->assertJsonPath('total_transactions', 3);
            $this->getJson('/api/analytics/transactions?department=Cashier&period=semester')
                ->assertJsonPath('total_transactions', 4);
            $this->getJson('/api/analytics/transactions?department=Cashier&period=custom&start_date=2026-08-06&end_date=2026-08-08')
                ->assertJsonPath('total_transactions', 1);
        } finally {
            Carbon::setTestNow();
        }
    }

    private function completedTicket(string $number, string $serviceType, string $transactionType, ?Carbon $completedAt = null): QueueTicket
    {
        $completedAt ??= Carbon::now();

        return QueueTicket::create([
            'ticket_number' => $number,
            'service_type' => $serviceType,
            'transaction_type' => $transactionType,
            'priority_type' => 'R',
            'status' => 'done',
            'created_at' => $completedAt->copy()->subMinutes(10),
            'called_at' => $completedAt->copy()->subMinutes(5),
            'completed_at' => $completedAt,
        ]);
    }
}
