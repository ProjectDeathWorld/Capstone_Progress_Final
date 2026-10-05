<?php

namespace App\Services;

use App\Models\DisplaySetting;

class Departments
{
    public const TYPES = ['Cashier' => 'C', 'Registrar' => 'R', 'ITM' => 'ITM', 'Admission' => 'ADM'];

    public static function name(?string $value): ?string
    {
        return match (strtolower(trim((string) $value))) {
            'c', 'cs', 'cashier', 'accounting', 'accounting / cashier', 'accounting/cashier' => 'Cashier',
            'r', 'rt', 'registrar' => 'Registrar',
            'itm' => 'ITM',
            'adm', 'admission', 'assessment' => 'Admission',
            default => null,
        };
    }

    public static function types(string $department): array
    {
        return match (self::name($department)) {
            'Cashier' => ['C', 'CS'], 'Registrar' => ['R', 'RT'],
            'ITM' => ['ITM'], 'Admission' => ['ADM'], default => [],
        };
    }

    public static function enabled(?array $settings = null): array
    {
        $settings ??= DisplaySetting::latest('id')->value('settings') ?? [];
        $enabledDepartments = $settings['enabledDepartments'] ?? ['Cashier', 'Registrar'];

        return array_values(array_unique(array_filter(array_map(
            fn ($department) => is_string($department) ? self::name($department) : null,
            is_array($enabledDepartments) ? $enabledDepartments : []
        ))));
    }

    public static function assertEnabled(?string $department): void
    {
        abort_unless(in_array(self::name($department), self::enabled(), true), 403, 'This department is disabled by the administrator.');
    }

    public static function enabledTypes(): array
    {
        return array_merge([], ...array_map(fn ($name) => self::types($name), self::enabled()));
    }
}
