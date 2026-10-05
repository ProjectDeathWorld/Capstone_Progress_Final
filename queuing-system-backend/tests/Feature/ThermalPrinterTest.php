<?php

namespace Tests\Feature;

use App\Models\DisplaySetting;
use App\Models\QueueTicket;
use App\Services\ThermalPrinterService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ThermalPrinterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        DisplaySetting::create([
            'settings' => [
                'enabledDepartments' => ['Cashier', 'Registrar', 'ITM', 'Admission'],
            ],
        ]);
    }

    public function test_department_labels_match_requirements(): void
    {
        $cashierTicket = new QueueTicket(['service_type' => 'C']);
        $this->assertSame('CASHIER', ThermalPrinterService::getDepartmentLabel($cashierTicket));

        $registrarTicket = new QueueTicket(['service_type' => 'R']);
        $this->assertSame('REGISTRAR', ThermalPrinterService::getDepartmentLabel($registrarTicket));

        $itmTicket = new QueueTicket(['service_type' => 'ITM']);
        $this->assertSame('ITM', ThermalPrinterService::getDepartmentLabel($itmTicket));

        $admTicket = new QueueTicket(['service_type' => 'ADM']);
        $this->assertSame('ADMISSION', ThermalPrinterService::getDepartmentLabel($admTicket));
    }

    public function test_escpos_stream_contains_required_fields_and_cut(): void
    {
        $escpos = ThermalPrinterService::buildEscPos('CASHIER', 'C-R001', '10/05/2026');

        $this->assertStringContainsString('LYCEUM OF ALABANG', $escpos);
        $this->assertStringContainsString('CASHIER', $escpos);
        $this->assertStringContainsString('QUEUE NUMBER', $escpos);
        $this->assertStringContainsString('C-R001', $escpos);
        $this->assertStringContainsString('Date: 10/05/2026', $escpos);

        // Auto-cut command: GS V 65 0 (\x1DV\x41\x00)
        $this->assertStringContainsString("\x1DV\x41\x00", $escpos);
    }

    public function test_printing_failure_does_not_break_ticket_generation(): void
    {
        $response = $this->postJson('/api/queue/generate', [
            'service_type' => 'C',
            'student_number' => 'Guest',
            'priority_type' => 'R',
            'transaction_type' => 'Payment',
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure([
            'message',
            'ticket' => ['ticket_id', 'ticket_number', 'service_type'],
            'print',
        ]);

        $this->assertNotEmpty($response->json('ticket.ticket_number'));
        $this->assertFalse($response->json('print.success'));
    }
}
