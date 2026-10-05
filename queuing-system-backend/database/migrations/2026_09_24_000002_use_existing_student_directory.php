<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Repairs the short-lived table created by the first version of this
        // feature. Existing directory data wins; any records in that table are
        // retained before it is removed.
        if (!Schema::hasTable('students')) {
            return;
        }

        if (Schema::hasTable('student_directory')) {
            DB::table('students')->orderBy('id')->each(function ($student) {
                DB::table('student_directory')->updateOrInsert(
                    ['student_number' => $student->student_number],
                    [
                        'student_name' => $student->student_name,
                        'course' => $student->course,
                        'registrar_window' => $student->registrar_window,
                        'updated_at' => $student->updated_at ?? now(),
                    ]
                );
            });
            Schema::drop('students');
            return;
        }

        Schema::rename('students', 'student_directory');
    }

    public function down(): void
    {
        // The legacy duplicate must not be recreated on rollback.
    }
};
