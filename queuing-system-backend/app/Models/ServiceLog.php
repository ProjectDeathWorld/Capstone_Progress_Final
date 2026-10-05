<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceLog extends Model
{
    protected $table = 'service_logs';
    protected $primaryKey = 'log_id';
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'action',
        'created_at'
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    // Relationship
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}