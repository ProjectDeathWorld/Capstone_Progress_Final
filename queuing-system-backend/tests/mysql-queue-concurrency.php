<?php
// Real MySQL lock test. Creates and drops only its own uniquely named empty database.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use App\Models\{User, QueueTicket, ServiceTransaction};
use App\Http\Controllers\Api\QueueController;
use Illuminate\Http\Request;

function selectTestDatabase(string $database): void {
    if (!preg_match('/^qms_routing_test_[a-f0-9]{12}$/D', $database)) throw new RuntimeException('Invalid test database');
    config(['database.connections.routing_test'=>array_merge(config('database.connections.mysql'), ['database'=>$database]), 'database.default'=>'routing_test']);
}
if (($argv[1] ?? '') === 'worker') {
    selectTestDatabase($argv[2]);
    $staff=User::findOrFail((int)$argv[3]);
    $request=Request::create('/api/queue/call','POST');
    $request->setUserResolver(fn()=>$staff);
    echo "READY\n"; flush();
    $response=app(QueueController::class)->callNextTicket($request);
    echo json_encode(['status'=>$response->getStatusCode(),'body'=>$response->getData(true)])."\n";
    exit;
}
$database='qms_routing_test_'.bin2hex(random_bytes(6));
$source=config('database.connections.mysql.database');
if (!preg_match('/^[a-zA-Z0-9_]+$/D',$source)) throw new RuntimeException('Unexpected source database name');
$admin=DB::connection('mysql');
$admin->statement("CREATE DATABASE `$database`");
try {
    foreach (['users','service_windows','queue_tickets','service_transactions','service_logs'] as $table) {
        $admin->statement("CREATE TABLE `$database`.`$table` LIKE `$source`.`$table`");
    }
    selectTestDatabase($database);
    $staff=[];
    foreach ([1,2,3] as $n) $staff[]=User::create(['username'=>'cashier'.$n,'password'=>'test-only','full_name'=>'Cashier '.$n,'role'=>'staff','position'=>'cashier','status'=>'active']);
    foreach (range(1,10) as $round) {
        DB::table('service_transactions')->delete();
        DB::table('queue_tickets')->delete();
        foreach ([1,2,3] as $n) QueueTicket::create(['ticket_number'=>'C-R00'.$n,'service_type'=>'C','priority_type'=>'R','status'=>'waiting','created_at'=>now()]);
        DB::beginTransaction();
        QueueTicket::lockForUpdate()->get();
        $workers=[];
        // Round 10 sends two overlapping requests for the same staff account.
        foreach ($round===10 ? [$staff[0],$staff[0]] : $staff as $user) {
            $process=proc_open([PHP_BINARY,__FILE__,'worker',$database,(string)$user->user_id],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
            fclose($pipes[0]);
            if (trim(fgets($pipes[1]))!=='READY') throw new RuntimeException('Worker failed to start');
            $workers[]=[$process,$pipes];
        }
        usleep(300000);
        DB::commit();
        $ids=[];
        foreach ($workers as [$process,$pipes]) {
            $output=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);
            fclose($pipes[1]);fclose($pipes[2]);$exit=proc_close($process);
            $result=json_decode(trim($output),true);
            if ($exit!==0 || ($result['status']??0)!==200) throw new RuntimeException('Worker failure: '.$output.$error);
            $ids[]=$result['body']['ticket']['ticket_id'];
        }
        $expected=$round===10?1:3;
        if(count(array_unique($ids))!==$expected || ServiceTransaction::count()!==$expected) throw new RuntimeException('Duplicate/missing claim');
        echo 'PASS round '.$round.': '.($round===10?'same-staff idempotency':'3 simultaneous Cashier claims, distinct tickets')."\n";
    }
} finally {
    if (DB::transactionLevel()) DB::rollBack();
    DB::disconnect('routing_test');
    $admin->statement("DROP DATABASE `$database`");
}
