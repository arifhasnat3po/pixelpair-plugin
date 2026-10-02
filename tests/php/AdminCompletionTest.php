<?php
/** @package PixelPair */
use PixelPair\Admin\TransferController;
use PixelPair\Events\Custom\Repository as Rules;
final class AdminCompletionTest extends LifecycleTestCase {
 public function test_import_does_not_publish_values_to_cache_before_commit_or_on_rollback(): void {
  $service=new TransferController();$before=$service->export();$input=$before;$input['settings']['strict_cache_mode']=!$before['settings']['strict_cache_mode'];$observed=array();global $wpdb;
  foreach(array(false,true) as $fail){$probe=static function($sql)use(&$observed,$fail,$wpdb){if(strpos($sql,'DELETE FROM '.$wpdb->prefix.'pixelpair_events')!==false){$all=wp_cache_get('alloptions','options');$observed[]=maybe_unserialize($all['pixelpair_settings']??wp_cache_get('pixelpair_settings','options'));if($fail){return 'INVALID IMPORT QUERY';}}return $sql;};add_filter('query',$probe);$old=$wpdb->suppress_errors();try{$r=$service->import($input);}finally{$wpdb->suppress_errors($old);remove_filter('query',$probe);}
   $this->assertSame($before['settings']['strict_cache_mode'],$observed[count($observed)-1]['strict_cache_mode']);
   if($fail){$this->assertInstanceOf(WP_Error::class,$r);$this->assertSame($before['settings'],(new \PixelPair\Settings\Repository())->get());}else{$this->assertIsArray($r);$this->assertSame($input['settings'],(new \PixelPair\Settings\Repository())->get());$service->import($before);}
  }
 }
 private $actor;
 protected function setUp(): void {parent::setUp();\PixelPair\Settings\Migrations::run();$this->actor=wp_create_user('admin-complete-'.wp_generate_password(8,false),'password');$user=new WP_User($this->actor);$user->set_role('administrator');$user->add_cap('manage_pixelpair');wp_set_current_user($this->actor);}
 protected function tearDown(): void {require_once ABSPATH.'wp-admin/includes/user.php';wp_delete_user($this->actor);parent::tearDown();}
 public function test_portable_transfer_has_no_secrets_scripts_or_permissions_and_is_atomic(): void {
  $this->assertTrue(class_exists(TransferController::class));$service=new TransferController();$export=$service->export();$this->assertSame(1,$export['version']);$this->assertSame(array('format','version','settings','events'),array_keys($export));
  $original=(new \PixelPair\Settings\Repository())->get();$bad=$export;$bad['settings']['access_token']='secret';$this->assertInstanceOf(WP_Error::class,$service->import($bad));$this->assertSame($original,(new \PixelPair\Settings\Repository())->get());
  $bad=$export;$bad['settings']['strict_cache_mode']=true;$bad['events'][]=array('name'=>'invalid');$this->assertInstanceOf(WP_Error::class,$service->import($bad));$this->assertSame($original,(new \PixelPair\Settings\Repository())->get());
  $good=$export;$good['settings']['strict_cache_mode']=true;$block=static function($new,$old){return $old;};add_filter('pre_update_option_pixelpair_settings',$block,10,2);try{$this->assertInstanceOf(WP_Error::class,$service->import($good));$this->assertSame($export['events'],$service->export()['events']);}finally{remove_filter('pre_update_option_pixelpair_settings',$block,10);}
  $this->assertIsArray($service->import($good));$this->assertTrue((new \PixelPair\Settings\Repository())->get()['strict_cache_mode']);
  wp_set_current_user(0);$this->assertInstanceOf(WP_Error::class,$service->import($export));
 }
 public function test_role_grants_need_manage_options_and_cannot_remove_admin(): void {
  $this->assertTrue(class_exists(\PixelPair\Admin\PermissionsController::class));$service=new \PixelPair\Admin\PermissionsController();$this->assertIsArray($service->save(array('editor')));$this->assertTrue(get_role('administrator')->has_cap('manage_pixelpair'));$this->assertTrue(get_role('editor')->has_cap('manage_pixelpair'));
  wp_get_current_user()->add_cap('manage_options',false);$this->assertInstanceOf(WP_Error::class,$service->save(array()));$this->assertTrue(get_role('editor')->has_cap('manage_pixelpair'));
 }
 public function test_dashboard_reports_configuration_without_credentials_and_log_filters_are_isolated(): void {
  $this->assertTrue(class_exists(\PixelPair\Admin\DashboardController::class));$r=(new \PixelPair\Admin\DashboardController())->status();$this->assertArrayHasKey('platforms',$r);$this->assertArrayHasKey('checks',$r);$this->assertStringNotContainsString('access_token',wp_json_encode($r));
  (new \PixelPair\Settings\Repository())->update(array('logging_enabled'=>true));$logs=new \PixelPair\Logs\Repository();$logs->record('Purchase','sent',array(),'meta');$logs->record('Purchase','failed',array(),'tiktok');$listing=$logs->listing(1,'failed','tiktok');$this->assertNotEmpty($listing['items']);foreach($listing['items'] as $row){$this->assertSame('tiktok',$row['platform']);$this->assertSame('failed',$row['status']);}
 }
}
