<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KpiMonitoring extends Model
{
    protected $table = 'kpi_monitoring';
    protected $primaryKey = 'kpi_id';
    public $timestamps = false;

    protected $fillable = [
        'staff_id',
        'date_range_start',
        'date_range_end',
        'total_transactions',
        'avg_service_time',
        'excellent_count',
        'verygood_count',
        'good_count',
        'fair_count',
        'poor_count',
        'kpi_score'
    ];

    protected $casts = [
        'date_range_start' => 'date',
        'date_range_end' => 'date',
    ];

    // Relationship
    public function staff()
    {
        return $this->belongsTo(User::class, 'staff_id', 'user_id');
    }
}