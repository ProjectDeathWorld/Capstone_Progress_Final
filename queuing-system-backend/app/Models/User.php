<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;

    protected $table = 'users';
    protected $primaryKey = 'user_id';
    public $timestamps = false;

    protected $fillable = [
        'username',
        'password',
        'full_name',
        'role',
        'position',
        'status',
        'security_code'
    ];

    protected $hidden = [
        'password',
        'security_code',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
        ];
    }

    protected $appends = [
        'department',
        'is_head_admin',
        'is_dept_admin',
    ];

    public function isHeadAdmin(): bool
    {
        $role = strtolower(trim((string) $this->role));
        return $role === 'admin' && empty($this->position);
    }

    public function isDeptAdmin(): bool
    {
        $role = strtolower(trim((string) $this->role));
        return $role === 'dept_admin' || ($role === 'admin' && !empty($this->position));
    }

    public function isAdmin(): bool
    {
        return $this->isHeadAdmin() || $this->isDeptAdmin();
    }

    public function getDepartmentAttribute(): ?string
    {
        if (empty($this->position)) {
            return null;
        }
        return \App\Services\Departments::name($this->position);
    }

    public function getIsHeadAdminAttribute(): bool
    {
        return $this->isHeadAdmin();
    }

    public function getIsDeptAdminAttribute(): bool
    {
        return $this->isDeptAdmin();
    }

    // Relationships
    public function serviceTransactions()
    {
        return $this->hasMany(ServiceTransaction::class, 'staff_id', 'user_id');
    }

    public function kpiMonitoring()
    {
        return $this->hasMany(KpiMonitoring::class, 'staff_id', 'user_id');
    }

    public function serviceLogs()
    {
        return $this->hasMany(ServiceLog::class, 'user_id', 'user_id');
    }

    public function assignedWindow()
    {
        return $this->hasOne(ServiceWindow::class, 'staff_id', 'user_id');
    }
}
