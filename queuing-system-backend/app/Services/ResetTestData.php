<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class ResetTestData
{
    public const PRESERVED = ['users', 'student_directory', 'service_windows', 'display_windows', 'display_settings', 'personal_access_tokens', 'sessions', 'migrations'];
    public const CLEARED = ['service_transactions', 'queue_tickets'];

    public function operationalLogs()
    {
        return DB::table('service_logs')->where(function ($query) {
            $query->where('action', 'like', 'Called ticket: %')
                ->orWhere('action', 'like', 'Completed ticket: %')
                ->orWhere('action', 'like', 'Skipped / no show: %');
        });
    }

    public function counts(): array
    {
        return [
            'service_transactions' => DB::table('service_transactions')->count(),
            'queue_tickets' => DB::table('queue_tickets')->count(),
            'operational_service_logs' => $this->operationalLogs()->count(),
        ];
    }

    public function fingerprints(): array
    {
        $result = [];
        foreach (self::PRESERVED as $table) {
            $rows = DB::table($table)->get()->map(fn ($row) => json_encode($row))->sort()->values()->all();
            $result[$table] = hash('sha256', json_encode($rows));
        }
        $result['preserved_service_logs'] = hash('sha256', json_encode(
            DB::table('service_logs')->whereNotIn('log_id', $this->operationalLogs()->select('log_id'))
                ->orderBy('log_id')->get()->all()
        ));
        return $result;
    }

    public function clear(): array
    {
        // This allowlist deliberately fails closed if deployment schema has changed.
        $expected = [...self::PRESERVED, ...self::CLEARED, 'service_logs'];
        $schema = DB::getDriverName() === 'sqlite' ? 'main' : DB::getDatabaseName();
        $actual = Schema::getTableListing($schema, schemaQualified: false);
        if (array_diff($actual, $expected) || array_diff($expected, $actual)) {
            throw new RuntimeException('Database tables differ from the inspected schema. Inspect before resetting.');
        }

        return DB::transaction(function () {
            $before = $this->fingerprints();
            $deleted = ['operational_service_logs' => $this->operationalLogs()->delete()];
            foreach (self::CLEARED as $table) {
                $deleted[$table] = DB::table($table)->delete();
            }
            if (array_sum($this->counts()) !== 0 || $before !== $this->fingerprints()) {
                throw new RuntimeException('Reset verification failed; deletion rolled back.');
            }
            return $deleted;
        });
    }
}
