<?php
/** Race one purchase claim in the disposable local fixture. */
if (!defined('WP_CLI') || !WP_CLI || 'local'!==wp_get_environment_type()) { throw new RuntimeException('Local fixture required.'); }
$key=$args[0]??'';$at=(float)($args[1]??0);
if(!preg_match('/\Awoo:purchase:[a-f0-9-]{36}\z/',$key)||$at>microtime(true)+15){throw new RuntimeException('Invalid race input.');}
while(microtime(true)<$at){usleep(10000);}
$id=\PixelPair\Commerce\Claims::id($key);$won=\PixelPair\Commerce\Claims::claim_browser($key,'meta');
echo wp_json_encode(array('id'=>$id,'won'=>$won));
