<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    public const REGISTRAR_WINDOWS_BY_COURSE = [
        'BSCRIM' => 9, 'BSPSYCH' => 9,
        'BSIT' => 10, 'BSCS' => 10, 'BSIE' => 10, 'BSCPE' => 10,
        'BSHM' => 11, 'BSTM' => 11,
        'BSA' => 12, 'EDUC' => 12, 'PTCP' => 12,
        'BSBA' => 13,
    ];
    // The existing student directory is the database source of truth.
    protected $table = 'student_directory';

    protected $fillable = ['student_number', 'student_name', 'course', 'registrar_window'];

    protected $casts = ['registrar_window' => 'integer'];

    public static function registrarWindowForCourse(?string $course): ?int
    {
        return self::REGISTRAR_WINDOWS_BY_COURSE[strtoupper(trim((string) $course))] ?? null;
    }
}
