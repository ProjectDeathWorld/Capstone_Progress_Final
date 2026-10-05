<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DisplaySetting extends Model
{
    protected $fillable = ['settings', 'published_by'];
    protected $casts = ['settings' => 'array'];
}
