<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PerformanceRule extends Model
{
    protected $table = 'performance_rules';
    protected $primaryKey = 'rule_id';
    public $timestamps = false;

    protected $fillable = [
        'min_time',
        'max_time',
        'rating'
    ];
}