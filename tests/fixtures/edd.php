<?php
/** Disposable real EDD fixture, never run on a live site. */
if(!defined('WP_CLI')||!WP_CLI||'local'!==wp_get_environment_type()){throw new RuntimeException('Disposable local fixture required.');}
if(!function_exists('edd_get_order')){throw new RuntimeException('EDD 3.x required.');}
edd_install_component_database_tables();PixelPair\Activation::activate(false);
edd_update_option('test_mode',true);edd_update_option('gateways',array('manual'=>1));edd_update_option('default_gateway','manual');edd_update_option('currency','USD');edd_update_option('enable_taxes',false);edd_update_option('item_quantities',true);edd_update_option('require_login',false);
update_option('edd_onboarding_completed',true);delete_transient('edd_onboarding_redirect');
$page=static function($slug,$content){$p=get_page_by_path($slug);return $p?$p->ID:wp_insert_post(array('post_type'=>'page','post_status'=>'publish','post_title'=>$slug,'post_name'=>$slug,'post_content'=>$content));};
$checkout=$page('pixelpair-edd-checkout','[download_checkout]');$receipt=$page('pixelpair-edd-receipt','[edd_receipt]');edd_update_option('purchase_page',$checkout);edd_update_option('success_page',$receipt);
$product=get_page_by_path('pixelpair-edd-product',OBJECT,'download');$id=$product?$product->ID:wp_insert_post(array('post_type'=>'download','post_status'=>'publish','post_title'=>'PixelPair Ebook','post_name'=>'pixelpair-edd-product','post_content'=>'Test ebook.'));
update_post_meta($id,'edd_price','10');update_post_meta($id,'edd_sku','EDD-BOOK');update_post_meta($id,'_variable_pricing',1);update_post_meta($id,'edd_variable_prices',array(array('name'=>'Basic','amount'=>'10'),array('name'=>'Pro','amount'=>'25')));
$s=PixelPair\Commerce\Settings::defaults();$s['enabled']=true;$s['content_id']='sku';
$r=(new PixelPair\Settings\Repository())->update(array('edd'=>$s,'meta_enabled'=>true,'meta_pixel_id'=>'123456789012345','meta_capi_enabled'=>false,'tiktok_enabled'=>true,'tiktok_pixel_id'=>'C1234567890ABCDEFGHI','tiktok_capi_enabled'=>false,'ga4_enabled'=>true,'ga4_ids'=>array('G-TEST123'),'google_data_layer'=>'dataLayer','deny_until_consent'=>false,'excluded_roles'=>array(),'excluded_ips'=>array()));if(is_wp_error($r)){throw new RuntimeException($r->get_error_message());}
$confirmation=(int)edd_get_option('confirmation_page',$receipt);
$confirmation_url=get_permalink($confirmation);
wp_cache_flush();echo wp_json_encode(compact('id','checkout','receipt','confirmation','confirmation_url'));
