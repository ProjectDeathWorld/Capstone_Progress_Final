<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\DisplaySetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DisplayConfigurationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_publish_and_public_display_can_read_configuration(): void
    {
        DisplaySetting::forceCreate([
            'id' => 2,
            'settings' => ['enabledDepartments' => ['Cashier', 'Registrar'], 'schoolName' => 'Stale'],
        ]);
        $admin = User::create([
            'username' => 'admin-display', 'password' => 'password', 'full_name' => 'Admin',
            'role' => 'admin', 'status' => 'active',
        ]);
        Sanctum::actingAs($admin);

        $payload = [
            'settings' => [
                'schoolName' => 'Lyceum Test',
                'enabledDepartments' => ['Cashier', 'Registrar', 'ITM', 'Assessment'],
                'waitingLimit' => 6,
                'queuePosition' => 'right',
                'layout' => 'wide',
                'displayFontFamily' => 'georgia',
                'displayTextSize' => 'large',
                'waitingFontSize' => 'small',
                'theme' => 'light',
                'backgroundColor' => '#123456',
                'announcement' => 'Updated scrolling text',
                'panelColors' => [
                    'Cashier' => ['background' => '#6d28d9', 'text' => '#ffffff'],
                    'ITM' => ['background' => '#0369a1', 'text' => '#ffffff'],
                ],
                'displayLabels' => [
                    'nowServing' => 'SERVING NOW',
                    'window' => 'COUNTER',
                    'departmentNames' => ['Cashier' => 'Payment Desk'],
                    'windowLabels' => ['Cashier:1' => 'Main Counter'],
                ],
            ],
            'windows' => [
                ['windowNumber' => 1, 'displayName' => 'Main Counter', 'department' => 'Cashier', 'color' => '#2563eb', 'visible' => false],
                ['windowNumber' => 9, 'displayName' => 'Records', 'department' => 'Registrar', 'color' => '#10b981', 'visible' => true],
                ['windowNumber' => 1, 'displayName' => 'ITM Desk', 'department' => 'ITM', 'color' => '#0284c7', 'visible' => true],
                ['windowNumber' => 1, 'displayName' => 'Assessment Desk', 'department' => 'Admission', 'color' => '#8b5cf6', 'visible' => true],
            ],
        ];

        $this->putJson('/api/display-configuration', $payload)
            ->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('settings.schoolName', 'Lyceum Test')
            ->assertJsonPath('settings.enabledDepartments', ['Cashier', 'Registrar', 'ITM', 'Admission'])
            ->assertJsonPath('settings.backgroundColor', '#123456')
            ->assertJsonPath('settings.layout', 'wide')
            ->assertJsonPath('settings.displayFontFamily', 'georgia')
            ->assertJsonPath('settings.displayTextSize', 'large')
            ->assertJsonPath('settings.waitingFontSize', 'small')
            ->assertJsonPath('settings.theme', 'light')
            ->assertJsonPath('settings.panelColors.Cashier.background', '#6d28d9')
            ->assertJsonPath('settings.panelColors.ITM.background', '#0369a1')
            ->assertJsonPath('settings.announcement', 'Updated scrolling text')
            ->assertJsonPath('settings.displayLabels.nowServing', 'SERVING NOW')
            ->assertJsonPath('settings.displayLabels.windowLabels.Cashier:1', 'Main Counter')
            ->assertJsonCount(4, 'windows')
            ->assertJsonPath('windows.0.visible', false)
            ->assertJsonPath('windows.3.department', 'Admission');

        $this->assertDatabaseHas('display_windows', [
            'window_number' => 1, 'display_name' => 'Main Counter', 'is_visible' => false, 'sort_order' => 1,
        ]);
        $this->assertDatabaseHas('display_windows', [
            'department' => 'Admission', 'window_number' => 1, 'display_name' => 'Assessment Desk',
            'display_color' => '#8b5cf6', 'is_visible' => true,
        ]);

        $singleChangePayload = $this->getJson('/api/display-configuration')->assertOk()->json();
        $singleChangePayload['settings']['schoolName'] = 'Single Change Saved';
        $this->putJson('/api/display-configuration', $singleChangePayload)
            ->assertOk()
            ->assertJsonPath('settings.schoolName', 'Single Change Saved')
            ->assertJsonPath('settings.backgroundColor', '#123456')
            ->assertJsonPath('settings.layout', 'wide')
            ->assertJsonPath('settings.displayFontFamily', 'georgia')
            ->assertJsonPath('settings.displayTextSize', 'large')
            ->assertJsonPath('settings.panelColors.ITM.background', '#0369a1')
            ->assertJsonPath('settings.enabledDepartments', ['Cashier', 'Registrar', 'ITM', 'Admission'])
            ->assertJsonCount(4, 'windows');

        auth()->forgetGuards();
        $this->getJson('/api/display-configuration')
            ->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('settings.queuePosition', 'right')
            ->assertJsonPath('settings.panelColors.Cashier.background', '#6d28d9')
            ->assertJsonPath('settings.panelColors.ITM.background', '#0369a1')
            ->assertJsonPath('settings.displayLabels.departmentNames.Cashier', 'Payment Desk')
            ->assertJsonPath('settings.displayLabels.windowLabels.Cashier:1', 'Main Counter')
            ->assertJsonPath('settings.schoolName', 'Single Change Saved')
            ->assertJsonPath('settings.layout', 'wide')
            ->assertJsonPath('settings.displayFontFamily', 'georgia')
            ->assertJsonPath('settings.displayTextSize', 'large')
            ->assertJsonPath('windows.0.displayName', 'Main Counter')
            ->assertJsonPath('windows.3.displayName', 'Assessment Desk');

        $this->assertSame('#6d28d9', DisplaySetting::findOrFail(2)->settings['panelColors']['Cashier']['background']);
        $this->assertSame('#0369a1', DisplaySetting::findOrFail(2)->settings['panelColors']['ITM']['background']);
    }
}
