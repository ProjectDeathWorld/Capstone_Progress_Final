<?php

namespace Tests\Feature;

use App\Models\QueueTicket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DashboardWaitingTimeTest extends TestCase
{
    use RefreshDatabase;

    public function test_empty_dashboard_has_zero_waiting_metrics(): void
    {
        Sanctum::actingAs($this->admin());

        $this->getJson('/api/analytics/dashboard')
            ->assertOk()
            ->assertJsonPath('average_waiting_time', 0)
            ->assertJsonPath('longest_waiting_time', 0)
            ->assertJsonPath('longest_waiting_time_formatted', '0 min');
    }

    public function test_longest_waiting_uses_called_time_and_current_time_only_for_waiting_tickets(): void
    {
        $now = now();

        $this->ticket('R-R001', 'waiting', $now->copy()->subMinutes(2));
        $this->ticket('R-R002', 'serving', $now->copy()->subMinutes(13), $now->copy()->subMinutes(10));
        $this->ticket('R-R003', 'done', $now->copy()->subMinutes(20), $now->copy()->subMinutes(5), $now->copy()->subMinutes(1));

        Sanctum::actingAs($this->admin());

        $this->getJson('/api/analytics/dashboard')
            ->assertOk()
            ->assertJsonPath('longest_waiting_time', 15)
            ->assertJsonPath('longest_waiting_time_formatted', '15 min');
    }

    public function test_invalid_future_timestamp_is_excluded_from_waiting_metrics(): void
    {
        $now = now();
        $this->ticket('R-R001', 'waiting', $now->copy()->addHours(8));

        Sanctum::actingAs($this->admin());

        $this->getJson('/api/analytics/dashboard')
            ->assertOk()
            ->assertJsonPath('longest_waiting_time', 0)
            ->assertJsonPath('longest_waiting_time_formatted', '0 min');
    }

    private function admin(): User
    {
        return User::firstOrCreate(['username' => 'dashboard-admin'], [
            'password' => 'password',
            'full_name' => 'Dashboard Admin',
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    private function ticket(
        string $number,
        string $status,
        $createdAt,
        $calledAt = null,
        $completedAt = null
    ): QueueTicket {
        return QueueTicket::create([
            'ticket_number' => $number,
            'service_type' => 'R',
            'priority_type' => 'R',
            'status' => $status,
            'window' => 9,
            'created_at' => $createdAt,
            'called_at' => $calledAt,
            'completed_at' => $completedAt,
        ]);
    }
}
