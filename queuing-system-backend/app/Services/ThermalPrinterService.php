<?php

namespace App\Services;

use App\Models\QueueTicket;
use Illuminate\Support\Facades\Log;

class ThermalPrinterService
{
    /**
     * Resolve the uppercase department label according to requirements:
     * CASHIER (for Cashier / Accounting), REGISTRAR, ITM, ADMISSION
     */
    public static function getDepartmentLabel(QueueTicket $ticket): string
    {
        $dept = Departments::name($ticket->service_type);

        return match ($dept) {
            'Cashier' => 'CASHIER',
            'Registrar' => 'REGISTRAR',
            'ITM' => 'ITM',
            'Admission' => 'ADMISSION',
            default => strtoupper((string) ($dept ?: 'CASHIER')),
        };
    }

    /**
     * Build ESC/POS binary command stream for Xprinter-58IIB thermal printer (58mm paper).
     */
    public static function buildEscPos(string $department, string $ticketNumber, ?string $date = null): string
    {
        $date ??= now()->format('m/d/Y');
        $deptUpper = strtoupper(trim($department));

        $esc = "\x1B";
        $gs = "\x1D";

        $data = '';

        // Initialize printer
        $data .= $esc . "@";

        // Center alignment
        $data .= $esc . "a\x01";

        // Line 1: LYCEUM OF ALABANG (Bold)
        $data .= $esc . "!\x08";
        $data .= "LYCEUM OF ALABANG\n\n";

        // Line 2: [DEPARTMENT] (Bold)
        $data .= $esc . "!\x08";
        $data .= $deptUpper . "\n\n";

        // Line 3: QUEUE NUMBER (Bold)
        $data .= $esc . "!\x08";
        $data .= "QUEUE NUMBER\n\n";

        // Line 4: [Ticket Number] (Double width + Double height + Bold)
        $data .= $gs . "!\x11";
        $data .= $ticketNumber . "\n\n";

        // Line 5: Date: [Date] (Normal text, smaller)
        $data .= $gs . "!\x00";
        $data .= $esc . "!\x00";
        $data .= "Date: " . $date . "\n\n\n\n";

        // Cut Paper: GS V 65 0 (Full cut with feed, for printers with auto-cutter)
        $data .= $gs . "V\x41\x00";

        return $data;
    }

    /**
     * Attempt to dispatch thermal print job to Xprinter-58IIB.
     * If the printer is disconnected or unavailable, gracefully returns false
     * with an error message so the queue ticket is never lost.
     */
    public static function printTicket(QueueTicket $ticket): array
    {
        $department = self::getDepartmentLabel($ticket);
        $ticketNumber = (string) $ticket->ticket_number;
        $date = $ticket->created_at ? $ticket->created_at->format('m/d/Y') : now()->format('m/d/Y');

        $escposData = self::buildEscPos($department, $ticketNumber, $date);

        // Check if thermal printer is configured or available in environment
        $printerName = env('THERMAL_PRINTER_NAME', 'Xprinter-58IIB');

        // On Windows systems, check if printer can be written to directly or via spooler
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            try {
                // If printer port (e.g. USB001, COM, or local share) is specifically set
                $printerPort = env('THERMAL_PRINTER_PORT', null);
                if ($printerPort && @file_exists($printerPort)) {
                    $handle = @fopen($printerPort, 'wb');
                    if ($handle) {
                        fwrite($handle, $escposData);
                        fclose($handle);
                        return [
                            'success' => true,
                            'printer' => $printerName,
                            'method' => 'direct_port',
                        ];
                    }
                }

                // If printer is shared on localhost: \\127.0.0.1\<printerName>
                $sharePath = "\\\\127.0.0.1\\" . $printerName;
                $handle = @fopen($sharePath, 'wb');
                if ($handle) {
                    fwrite($handle, $escposData);
                    fclose($handle);
                    return [
                        'success' => true,
                        'printer' => $printerName,
                        'method' => 'windows_share',
                    ];
                }
            } catch (\Throwable $e) {
                Log::info('Direct Windows thermal print attempt: ' . $e->getMessage());
            }
        }

        // When server-side direct USB connection is not present (standard for web kiosks
        // where printer is driven through the client browser print engine), return clear status
        return [
            'success' => false,
            'printer' => $printerName,
            'message' => 'Thermal printer not attached to server spooler. Use kiosk client printing.',
        ];
    }
}
