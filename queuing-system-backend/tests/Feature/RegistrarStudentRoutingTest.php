<?php

namespace Tests\Feature;

use App\Models\ServiceWindow;
use App\Models\Student;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrarStudentRoutingTest extends TestCase
{
    use RefreshDatabase;

    private function openRegistrarWindows(): void
    {
        foreach ([9, 10, 11, 12, 13] as $number) {
            ServiceWindow::create([
                'department' => 'registrar', 'window_number' => $number,
                'service_type' => 'RT', 'service_scope' => 'department',
                'status' => 'open', 'is_available' => true,
            ]);
        }
    }

    public function test_lookup_and_ticket_routing_are_authoritative_for_every_registrar_window(): void
    {
        $this->openRegistrarWindows();

        $coursesByWindow = [9 => 'BSCRIM', 10 => 'BSIT', 11 => 'BSHM', 12 => 'BSA', 13 => 'BSBA'];
        foreach ($coursesByWindow as $window => $course) {
            $number = sprintf('%04d-23', $window);
            Student::create([
                'student_number' => $number, 'student_name' => "Student $window",
                'course' => $course, 'registrar_window' => $window,
            ]);

            $this->getJson("/api/students/$number")
                ->assertOk()->assertJsonPath('student_name', "Student $window")
                ->assertJsonPath('course', $course)
                ->assertJsonPath('registrar_window', $window);

            // A malicious client sends a different window. The stored directory
            // assignment must win and the request's window must be ignored.
            $response = $this->postJson('/api/queue/generate', [
                'service_type' => 'RT', 'student_number' => $number,
                'transaction_type' => 'Document Request', 'window' => 13,
            ])->assertCreated();

            $response->assertJsonPath('ticket.window', $window)
                ->assertJsonPath('ticket.student_name', "Student $window")
                ->assertJsonPath('ticket.course', $course)
                ->assertJsonPath('ticket.status', 'waiting');
        }
    }

    public function test_unknown_student_and_invalid_directory_assignment_cannot_generate_ticket(): void
    {
        $this->openRegistrarWindows();
        $this->getJson('/api/students/9999-23')->assertNotFound();
        $this->postJson('/api/queue/generate', ['service_type' => 'RT', 'student_number' => '9999-23'])
            ->assertNotFound();

        Student::create(['student_number' => '8888-23', 'student_name' => 'No Route', 'course' => 'BSIT', 'registrar_window' => 8]);
        $this->postJson('/api/queue/generate', ['service_type' => 'RT', 'student_number' => '8888-23'])
            ->assertStatus(422)->assertJsonPath('message', 'Registrar window assignment unavailable. Please proceed to the Registrar/Help Desk.');
    }

    public function test_guest_registrar_ticket_uses_the_selected_window(): void
    {
        $this->openRegistrarWindows();

        foreach ([9, 10, 11, 12, 13] as $window) {
            $this->postJson('/api/queue/generate', [
                'service_type' => 'RT',
                'student_number' => 'Guest',
                'transaction_type' => 'Document Request',
                'window' => $window,
            ])->assertCreated()->assertJsonPath('ticket.window', $window)
                ->assertJsonPath('ticket.student_number', 'Guest')
                ->assertJsonPath('ticket.student_name', null)
                ->assertJsonPath('ticket.course', null);
        }
    }

    public function test_guest_registrar_ticket_rejects_windows_outside_the_registrar_range(): void
    {
        $this->openRegistrarWindows();

        foreach ([1, 99] as $window) {
            $this->postJson('/api/queue/generate', [
                'service_type' => 'RT',
                'student_number' => 'Guest',
                'transaction_type' => 'Document Request',
                'window' => $window,
            ])->assertStatus(422);
        }
    }
}
