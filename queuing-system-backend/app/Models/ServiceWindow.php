<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ServiceWindow extends Model
{
    use HasFactory;

    protected $table = 'service_windows';

    protected $fillable = [
        'department',
        'window_number',
        'service_type',
        'service_scope',
        'is_available',
        'status',
        'staff_id',
        'disabled_reason',
    ];

    protected $casts = [
        'is_available' => 'boolean',
        'window_number' => 'integer',
        'staff_id' => 'integer',
    ];

    public function staff()
    {
        return $this->belongsTo(User::class, 'staff_id', 'user_id');
    }
}
