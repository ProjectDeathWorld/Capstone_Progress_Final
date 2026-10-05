<?php

namespace App\Console\Commands;

use App\Services\ResetTestData;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Symfony\Component\Process\Process;

class ResetQueueTestData extends Command
{
    protected $signature = 'qms:reset-test-data {--dry-run : Show counts without modifying anything} {--force : Explicitly confirm deletion without an interactive prompt} {--dump-binary=mysqldump : Path to mysqldump executable}';
    protected $description = 'One-time, backed-up removal of queue test operations; preserves accounts and configuration';

    public function handle(ResetTestData $reset): int
    {
        $this->warn('Deletes ALL queue tickets, service transactions, and Called/Completed/Skipped queue logs.');
        $this->info('Preserves users, credentials, windows, assignments, display settings, tokens, sessions and authentication logs.');
        $this->table(['Records to delete', 'Count'], collect($reset->counts())->map(fn ($count, $table) => [$table, $count])->values()->all());
        if ($this->option('dry-run')) {
            return self::SUCCESS;
        }
        if (!$this->option('force') && !$this->confirm('Back up this database, then permanently delete these test operations?', false)) {
            $this->info('Cancelled. No changes made.');
            return self::SUCCESS;
        }
        if (!app()->isDownForMaintenance()) {
            $this->error('First run php artisan down and stop queue writers/workers. Keep maintenance enabled until verification completes.');
            return self::FAILURE;
        }
        if (DB::getDriverName() !== 'mysql') {
            $this->error('This backup/reset command is restricted to the inspected MySQL deployment.');
            return self::FAILURE;
        }

        $directory = storage_path('app/private/qms-reset');
        if (!is_dir($directory) && !mkdir($directory, 0700, true)) {
            throw new RuntimeException('Cannot create private backup directory.');
        }
        $lock = fopen($directory.'/reset.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
            $this->error('Another reset is running.');
            return self::FAILURE;
        }

        try {
            $receipt = $directory.'/completed.json';
            if (is_file($receipt)) {
                throw new RuntimeException('One-time reset already completed. Refusing to delete later operational data.');
            }
            foreach (DB::select('SHOW TABLE STATUS') as $table) {
                if ($table->Engine !== 'InnoDB') {
                    throw new RuntimeException('Backup requires all tables to use InnoDB.');
                }
            }
            $config = DB::connection()->getConfig();
            $backup = $directory.'/before-reset-'.date('Ymd-His').'-'.bin2hex(random_bytes(4)).'.sql';
            $process = new Process([
                $this->option('dump-binary'), '--host='.$config['host'], '--port='.($config['port'] ?? 3306),
                '--user='.$config['username'], '--single-transaction', '--quick', '--hex-blob',
                '--routines', '--events', '--triggers', '--result-file='.$backup, $config['database'],
            ], null, ['MYSQL_PWD' => (string) ($config['password'] ?? '')]);
            $process->setTimeout(120);
            $process->mustRun();
            clearstatcache(true, $backup);
            if (!is_file($backup) || filesize($backup) < 100 || !str_contains(file_get_contents($backup), '-- Dump completed on')) {
                throw new RuntimeException('Backup verification failed. No deletion performed.');
            }
            $this->info('Verified full backup: '.$backup);
            $before = $reset->fingerprints();
            $deleted = $reset->clear();
            // MySQL ALTER TABLE commits implicitly: do this only after transactional deletion succeeds.
            // Foreign-key checks remain enabled. Retained log/user/configuration IDs are never reset.
            foreach (ResetTestData::CLEARED as $table) {
                DB::statement('ALTER TABLE `'.$table.'` AUTO_INCREMENT = 1');
            }
            if ($before !== $reset->fingerprints() || array_sum($reset->counts()) !== 0) {
                throw new RuntimeException('Post-reset verification failed. Keep maintenance enabled and inspect backup.');
            }
            $audit = ['completed_at' => now()->toIso8601String(), 'database' => $config['database'],
                'backup' => $backup, 'backup_sha256' => hash_file('sha256', $backup),
                'deleted' => $deleted, 'preserved_sha256' => $before, 'remaining' => $reset->counts()];
            if (file_put_contents($receipt, json_encode($audit, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX) === false) {
                throw new RuntimeException('Could not write reset receipt. Keep maintenance enabled.');
            }
            $this->info('Reset verified. All preserved data matches its original SHA-256 fingerprint.');
            $this->info('Receipt: '.$receipt);
            $this->info('Run php artisan up after verification to resume service.');
            return self::SUCCESS;
        } catch (\Throwable $error) {
            $this->error($error->getMessage());
            $this->error('Maintenance mode remains enabled. Inspect the failure before resuming service.');
            return self::FAILURE;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
