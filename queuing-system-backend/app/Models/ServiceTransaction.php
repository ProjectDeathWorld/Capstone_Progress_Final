<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceTransaction extends Model
{
    protected $table = 'service_transactions';
    protected $primaryKey = 'transaction_id';
    public $timestamps = false;

    protected $fillable = [
        'ticket_id',
        'staff_id',
        'start_time',
        'end_time',
        'duration_seconds',
        'performance_rating',
        'remarks'
    ];

    protected $casts = [
        'start_time' => 'datetime',
        'end_time' => 'datetime',
    ];

    // Relationships
    public function ticket()
    {
        return $this->belongsTo(QueueTicket::class, 'ticket_id', 'ticket_id');
    }

    public function staff()
    {
        return $this->belongsTo(User::class, 'staff_id', 'user_id');
    }
}