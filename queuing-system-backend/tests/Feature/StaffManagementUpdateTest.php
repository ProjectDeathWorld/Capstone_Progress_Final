<?php

namespace Tests\Feature;

use App\Models\ServiceWindow;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StaffManagementUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_update_only_staff_name_without_changing_password_or_window(): void
    {
        $admin = $this->user('admin1', 'admin', null, 'Administrator');
        $staff = $this->user('cashier1', 'staff', 'cashier', 'Erich Garcia');
        $originalPassword = $staff->password;
        $window = ServiceWindow::create([
            'department' => 'cashier', 'window_number' => 1, 'service_type' => 'CS',
            'staff_id' => $staff->user_id, 'is_available' => true, 'status' => 'open',
        ]);

        Sanctum::actingAs($admin);
        $this->putJson('/api/staff/'.$staff->user_id, [
            'username' => 'cashier1', 'full_name' => 'Erich Garcia Updated',
            'position' => 'cashier', 'status' => 'active',
        ])->assertOk()
            ->assertJsonPath('staff.full_name', 'Erich Garcia Updated')
            ->assertJsonMissingPath('staff.password');

        $this->assertDatabaseHas('users', ['user_id' => $staff->user_id, 'full_name' => 'Erich Garcia Updated']);
        $this->assertSame($originalPassword, $staff->fresh()->password);
        $this->assertDatabaseHas('service_windows', ['id' => $window->id, 'staff_id' => $staff->user_id, 'window_number' => 1]);
    }

    public function test_optional_password_is_updated_and_same_username_is_allowed(): void
    {
        $admin = $this->user('admin1', 'admin', null, 'Administrator');
        $staff = $this->user('registrar1', 'staff', 'registrar', 'Registrar Staff 1');
        Sanctum::actingAs($admin);

        $this->putJson('/api/staff/'.$staff->user_id, [
            'username' => 'registrar1', 'full_name' => 'Registrar Staff 1', 'position' => 'registrar',
            'status' => 'active', 'password' => 'new-password', 'password_confirmation' => 'new-password',
        ])->assertOk();

        $this->assertSame('new-password', $staff->fresh()->password);
    }

    public function test_admin_can_edit_itm_account_without_resubmitting_its_window(): void
    {
        $admin = $this->user('admin1', 'admin', null, 'Administrator');
        $itm = $this->user('itm1', 'staff', 'itm', 'ITM Staff');
        $window = ServiceWindow::whereRaw('LOWER(department) = ?', ['itm'])->firstOrFail();
        $window->update(['staff_id' => $itm->user_id]);
        Sanctum::actingAs($admin);

        $this->putJson('/api/staff/'.$itm->user_id, [
            'username' => 'itm1',
            'full_name' => 'Updated ITM Staff',
            'position' => 'itm',
            'status' => 'inactive',
            'password' => 'updated-password',
            'password_confirmation' => 'updated-password',
        ])->assertOk()
            ->assertJsonPath('staff.full_name', 'Updated ITM Staff')
            ->assertJsonPath('staff.position', 'itm')
            ->assertJsonPath('staff.status', 'inactive');

        $this->assertDatabaseHas('service_windows', [
            'id' => $window->id,
            'staff_id' => $itm->user_id,
            'service_type' => 'ITM',
        ]);
        $this->assertSame('updated-password', $itm->fresh()->password);

        $this->getJson('/api/staff')->assertOk()
            ->assertJsonFragment([
                'user_id' => $itm->user_id,
                'username' => 'itm1',
                'full_name' => 'Updated ITM Staff',
                'position' => 'itm',
                'status' => 'inactive',
            ]);
    }

    public function test_department_change_releases_the_old_window_without_combining_queues(): void
    {
        $admin = $this->user('admin1', 'admin', null, 'Administrator');
        $staff = $this->user('cashier1', 'staff', 'cashier', 'Staff Member');
        $window = ServiceWindow::create([
            'department' => 'cashier', 'window_number' => 1, 'service_type' => 'CS',
            'staff_id' => $staff->user_id, 'is_available' => true, 'status' => 'open',
        ]);
        Sanctum::actingAs($admin);

        $this->putJson('/api/staff/'.$staff->user_id, [
            'username' => 'cashier1', 'full_name' => 'Staff Member',
            'position' => 'itm', 'status' => 'active',
        ])->assertOk()->assertJsonPath('staff.position', 'itm');

        $this->assertNull($window->fresh()->staff_id);
        $this->assertSame('itm', $staff->fresh()->position);
    }

    public function test_non_admin_cannot_update_staff(): void
    {
        $cashier = $this->user('cashier1', 'staff', 'cashier', 'Cashier');
        $other = $this->user('cashier2', 'staff', 'cashier', 'Other Cashier');
        Sanctum::actingAs($cashier);

        $this->putJson('/api/staff/'.$other->user_id, ['full_name' => 'Unauthorized'])
            ->assertForbidden();
    }

    private function user(string $username, string $role, ?string $position, string $name): User
    {
        return User::create([
            'username' => $username, 'password' => 'password', 'full_name' => $name,
            'role' => $role, 'position' => $position, 'status' => 'active',
        ]);
    }
}
