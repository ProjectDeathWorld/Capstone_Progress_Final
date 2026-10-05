<?php

namespace App\Services;

use Carbon\Carbon;

final class WaitingTime
{
    public static function seconds($createdAt, $calledAt = null, $now = null): ?int
    {
        if (!$createdAt) {
            return null;
        }

        $created = $createdAt instanceof Carbon ? $createdAt : Carbon::parse($createdAt);
        $end = $calledAt
            ? ($calledAt instanceof Carbon ? $calledAt : Carbon::parse($calledAt))
            : ($now instanceof Carbon ? $now : ($now ? Carbon::parse($now) : now()));

        $seconds = $created->diffInSeconds($end, false);

        return $seconds >= 0 ? (int) $seconds : null;
    }

    public static function minutes($createdAt, $calledAt = null, $now = null): ?float
    {
        $seconds = self::seconds($createdAt, $calledAt, $now);

        return $seconds === null ? null : $seconds / 60;
    }

    public static function formatMinutes(float $minutes): string
    {
        if ($minutes <= 0) {
            return '0 min';
        }

        $seconds = (int) round($minutes * 60);
        $hours = intdiv($seconds, 3600);
        $remaining = $seconds % 3600;
        $wholeMinutes = intdiv($remaining, 60);
        $remainingSeconds = $remaining % 60;
        $parts = [];

        if ($hours > 0) {
            $parts[] = "{$hours} hr";
        }
        if ($wholeMinutes > 0) {
            $parts[] = "{$wholeMinutes} min";
        }
        if ($remainingSeconds > 0) {
            $parts[] = "{$remainingSeconds} sec";
        }

        return implode(' ', $parts) ?: '0 min';
    }
}
