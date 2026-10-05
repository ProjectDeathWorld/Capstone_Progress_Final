<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DisplaySetting;
use App\Models\DisplayWindow;
use App\Models\ServiceWindow;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DisplayConfigurationController extends Controller
{
    public function show()
    {
        $setting = DisplaySetting::latest('id')->first();
        $windows = DisplayWindow::with('serviceWindow.staff')->orderBy('sort_order')->get();
        if ($windows->isEmpty()) {
            $defaults = collect([1, 2, 3, 9, 10, 11, 12, 13]);
            $windows = $defaults->map(function ($number, $index) {
                $department = $number <= 3 ? 'Cashier' : 'Registrar';
                $serviceWindow = ServiceWindow::with('staff')
                    ->whereRaw('LOWER(department) = ?', [strtolower($department)])
                    ->where('window_number', $number)->first();
                $staff = $serviceWindow?->staff;
                if (!$staff) {
                    $accountNumber = $department === 'Registrar' ? $number - 8 : $number;
                    $staff = User::where('role', 'staff')->whereRaw('LOWER(position) = ?', [strtolower($department)])
                        ->where('username', 'like', '%'.$accountNumber)->first();
                }
                return (object) [
                    'id' => null, 'service_window_id' => $serviceWindow?->id, 'window_number' => $number,
                    'display_name' => $department.' Window '.$number, 'department' => $department,
                    'display_color' => $department === 'Cashier' ? '#2563eb' : '#10b981',
                    'is_visible' => true, 'sort_order' => $index + 1,
                    'serviceWindow' => $serviceWindow ? (object) ['staff' => $staff] : ($staff ? (object) ['staff' => $staff] : null),
                ];
            });
        }

        foreach (ServiceWindow::with('staff')->whereIn('service_type', ['ITM', 'ADM'])->orderBy('id')->get() as $serviceWindow) {
            if ($windows->contains(fn ($window) => strtolower($window->department) === strtolower($serviceWindow->department)
                && (int) $window->window_number === (int) $serviceWindow->window_number)) continue;
            $windows->push((object) [
                'service_window_id' => $serviceWindow->id, 'window_number' => $serviceWindow->window_number,
                'display_name' => $serviceWindow->department.' Window '.$serviceWindow->window_number,
                'department' => $serviceWindow->department,
                'display_color' => $serviceWindow->service_type === 'ITM' ? '#0284c7' : '#8b5cf6',
                'is_visible' => true, 'sort_order' => $windows->count() + 1, 'serviceWindow' => $serviceWindow,
            ]);
        }

        return response()->json([
            'settings' => array_merge($setting?->settings ?? [], ['enabledDepartments' => \App\Services\Departments::enabled($setting?->settings ?? [])]),
            'windows' => $windows->map(fn ($window) => [
                'id' => strtolower($window->department).'-window-'.$window->window_number,
                'serviceWindowId' => $window->service_window_id,
                'windowNumber' => $window->window_number,
                'displayName' => $window->display_name,
                'department' => \App\Services\Departments::name($window->department),
                'color' => $window->display_color,
                'visible' => $window->is_visible,
                'order' => $window->sort_order,
                'staffName' => $window->serviceWindow?->staff?->full_name ?? '',
            ])->values(),
            'published_at' => $setting?->updated_at,
        ])->header('Cache-Control', 'no-store, private');
    }

    public function update(Request $request)
    {
        abort_unless($request->user()?->isHeadAdmin(), 403);
        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.enabledDepartments' => 'sometimes|array',
            'settings.enabledDepartments.*' => 'required|distinct|in:Cashier,Registrar,ITM,Admission,Assessment',
            'windows' => 'required|array',
            'windows.*.windowNumber' => 'required|integer|min:1',
            'windows.*.displayName' => 'required|string|max:100',
            'windows.*.department' => 'required|in:Cashier,Registrar,ITM,Admission',
            'windows.*.color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'windows.*.visible' => 'required|boolean',
        ]);

        $validated['settings'] = $request->input('settings');
        unset($validated['settings']['itmMode'], $validated['settings']['systemMode']);
        $validated['settings']['enabledDepartments'] ??= \App\Services\Departments::enabled();
        $validated['settings']['enabledDepartments'] = \App\Services\Departments::enabled([
            'enabledDepartments' => $validated['settings']['enabledDepartments'],
        ]);
        DB::transaction(function () use ($validated, $request) {
            $setting = DisplaySetting::query()->latest('id')->lockForUpdate()->first();
            $settingData = [
                'settings' => $validated['settings'],
                'published_by' => $request->user()?->user_id,
            ];
            if ($setting) {
                $setting->update($settingData);
            } else {
                DisplaySetting::create($settingData);
            }
            \App\Models\ServiceLog::create([
                'user_id' => $request->user()->user_id,
                'action' => 'Published active departments: '.(implode(', ', $validated['settings']['enabledDepartments']) ?: 'None'),
                'created_at' => now(),
            ]);

            DisplayWindow::query()->delete();
            foreach (array_values($validated['windows']) as $index => $item) {
                $serviceWindow = ServiceWindow::whereRaw('LOWER(department) = ?', [strtolower($item['department'])])
                    ->where('window_number', $item['windowNumber'])->first();
                DisplayWindow::create([
                    'service_window_id' => $serviceWindow?->id,
                    'window_number' => $item['windowNumber'],
                    'display_name' => $item['displayName'],
                    'department' => $item['department'],
                    'display_color' => $item['color'],
                    'is_visible' => $item['visible'],
                    'sort_order' => $index + 1,
                ]);
            }
        });

        return $this->show();
    }

    public function upload(Request $request)
    {
        abort_unless($request->user()?->isHeadAdmin(), 403);
        $validated = $request->validate(['image' => 'required|image|max:5120']);
        $path = $validated['image']->store('display-board', 'public');

        return response()->json(['url' => asset('storage/'.$path)]);
    }
}
