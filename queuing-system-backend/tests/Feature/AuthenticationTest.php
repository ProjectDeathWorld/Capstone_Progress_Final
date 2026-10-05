<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_hashed_password_login_trims_username_and_creates_a_token(): void
    {
        $user = User::create([
            'username' => 'admin',
            'password' => 'admin-password',
            'full_name' => 'Administrator',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->assertTrue(Hash::check('admin-password', $user->fresh()->password));

        $this->postJson('/api/login', [
            'username' => '  admin  ',
            'password' => 'admin-password',
        ])
            ->assertOk()
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonStructure(['token']);
    }

    public function test_matching_legacy_plain_text_password_is_upgraded_after_login(): void
    {
        $userId = DB::table('users')->insertGetId([
            'username' => 'legacy-staff',
            'password' => 'legacy-password',
            'full_name' => 'Legacy Staff',
            'role' => 'staff',
            'position' => 'registrar',
            'status' => 'active',
        ], 'user_id');

        $this->postJson('/api/login', [
            'username' => 'legacy-staff',
            'password' => 'legacy-password',
        ])->assertOk();

        $storedPassword = User::findOrFail($userId)->password;
        $this->assertNotSame('legacy-password', $storedPassword);
        $this->assertTrue(Hash::check('legacy-password', $storedPassword));
    }

    public function test_wrong_credentials_and_inactive_accounts_have_distinct_responses(): void
    {
        User::create([
            'username' => 'inactive-staff',
            'password' => 'correct-password',
            'full_name' => 'Inactive Staff',
            'role' => 'staff',
            'position' => 'registrar',
            'status' => 'inactive',
        ]);

        $this->postJson('/api/login', [
            'username' => 'missing-user',
            'password' => 'wrong-password',
        ])->assertUnauthorized()->assertJsonPath('message', 'Invalid username or password.');

        $this->postJson('/api/login', [
            'username' => 'inactive-staff',
            'password' => 'correct-password',
        ])->assertForbidden()->assertJsonPath('message', 'This account is inactive.');
    }
    public function test_staff_logout_revokes_the_existing_token(): void
    {
        $staff = User::create([
            'username' => 'logout-staff', 'password' => 'staff-password',
            'full_name' => 'Logout Staff', 'role' => 'staff',
            'position' => 'cashier', 'status' => 'active',
        ]);
        $token = $staff->createToken('staff-test');
        $started = microtime(true);
        $this->withToken($token->plainTextToken)->postJson('/api/logout')->assertOk();
        fwrite(STDERR, sprintf("\nTest-database logout request: %.2f ms\n", (microtime(true) - $started) * 1000));
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $token->accessToken->id]);
        $this->app['auth']->forgetGuards();
        $this->withToken($token->plainTextToken)->getJson('/api/me')->assertUnauthorized();
    }
}
