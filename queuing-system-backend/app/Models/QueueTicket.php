<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QueueTicket extends Model
{
    protected $table = 'queue_tickets';
    protected $primaryKey = 'ticket_id';
    public $timestamps = false;

    protected $fillable = [
        'ticket_number',
        'service_type',
        'transaction_type',
        'student_number',
        'student_name',
        'course',
        'priority_type',
        'status',
        'window',
        'created_at',
        'called_at',
        'completed_at'
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'called_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    // Relationship
    public function serviceTransaction()
    {
        return $this->hasOne(ServiceTransaction::class, 'ticket_id', 'ticket_id');
    }
}
