<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DisplayWindow extends Model
{
    protected $fillable = ['service_window_id', 'window_number', 'display_name', 'department', 'display_color', 'is_visible', 'sort_order'];
    protected $casts = ['is_visible' => 'boolean', 'window_number' => 'integer', 'sort_order' => 'integer'];

    public function serviceWindow() { return $this->belongsTo(ServiceWindow::class); }
}
