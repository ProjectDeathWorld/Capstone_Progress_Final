<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;

class StudentController extends Controller
{
    /** Return only the directory information the kiosk needs for Registrar routing. */
    public function show(string $studentNumber)
    {
        $studentNumber = trim($studentNumber);

        if (!preg_match('/^\d{4}-23$/', $studentNumber)) {
            return response()->json(['message' => 'Student not found. Please check your Student Number.'], 404);
        }

        $student = Student::where('student_number', $studentNumber)->first();
        if (!$student) {
            return response()->json(['message' => 'Student not found. Please check your Student Number.'], 404);
        }

        $window = Student::registrarWindowForCourse($student->course);
        if (!$window || (int) $student->registrar_window !== $window) {
            return response()->json(['message' => 'Registrar window assignment unavailable. Please proceed to the Registrar/Help Desk.'], 422);
        }

        return response()->json([
            'student_number' => $student->student_number,
            'student_name' => $student->student_name,
            'course' => $student->course,
            'registrar_window' => $window,
        ]);
    }
}
