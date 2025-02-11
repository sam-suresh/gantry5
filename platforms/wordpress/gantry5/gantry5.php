<?php
/**
 * Plugin Name: Gantry 5 Framework
 * Plugin URI: http://gantry.org/
 * Description: Framework for Gantry 5 based themes.
 * Version: @version@
 * Author: RocketTheme, LLC
 * Author URI: http://rockettheme.com/
 * License: GNU General Public License v2 or later
 * License URI: http://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: gantry5
 * Domain Path: /admin/languages
 */

defined('ABSPATH') or die;

// NOTE: This file needs to be PHP 5.2 compatible.

// Fail safe version check for PHP <5.4.0.
if (version_compare(PHP_VERSION, '5.4.0', '<')) {
    if (is_admin()) {
        add_action('admin_notices', 'gantry5_php_version_warning');
    }
    return;
}

require_once dirname(__FILE__) . '/src/Loader.php';

if (!defined('GANTRY5_PATH')) {
    // Works also with symlinks.
    define('GANTRY5_PATH', rtrim(WP_PLUGIN_DIR, '/\\') . '/gantry5');
}

//add_action('upgrader_package_options', 'gantry5_install_prepare_options', 10, 1);
add_action('upgrader_process_complete', 'gantry5_install_clear_cache', 10, 2);

if (!is_admin()) {
    return;
}

// Load plugin settings.
require_once dirname(__FILE__) . '/admin/settings.php';

if (!defined('GANTRYADMIN_PATH')) {
    // Works also with symlinks.
    define('GANTRYADMIN_PATH', GANTRY5_PATH . '/admin');
}

// Add Gantry 5 defaults on plugin activation
// TODO: change the admin_init to a better hook ie. only when plugin updates
register_activation_hook(__FILE__, 'gantry5_plugin_defaults');
add_action('admin_init', 'gantry5_plugin_defaults');

function gantry5_plugin_defaults()
{
    $defaults = array(
        'production'      => '1',
        'debug'           => '0',
        'offline'         => '0',
        'offline_message' => 'Site is currently in offline mode. Please try again later.',
        'cache_path'      => '',
    );

    $option = (array)get_option('gantry5_plugin');

    update_option('gantry5_plugin', $option + $defaults);
}

add_filter('kses_allowed_protocols', 'add_gantry5_streams_to_kses');

function add_gantry5_streams_to_kses($protocols)
{
    $streams = array(
        'gantry-cache',
        'gantry-themes',
        'gantry-theme',
        'gantry-assets',
        'gantry-media',
        'gantry-engines',
        'gantry-engine',
        'gantry-layouts',
        'gantry-particles',
        'gantry-blueprints',
        'gantry-config',
        'wp-includes',
        'wp-content',
    );

    $protocols = array_merge($protocols, $streams);
    return $protocols;
}

// Initialize plugin language and fallback to en_US if the .mo file can't be found
$domain         = 'gantry5';
$languages_path = basename(GANTRY5_PATH) . '/admin/languages';

if (load_plugin_textdomain($domain, false, $languages_path) === false) {
    add_filter('plugin_locale', 'modify_gantry5_locale', 10, 2);
}

load_plugin_textdomain($domain, false, $languages_path);

function modify_gantry5_locale($locale, $domain)
{
    // Revert the gantry5 domain locale to en_US
    if (isset($domain) && $domain == 'gantry5') {
        $locale = 'en_US';
    }

    return $locale;
}

function gantry5_php_version_warning()
{
    echo '<div class="error"><p>';
    echo sprintf("You are running PHP %s, but Gantry 5 Framework needs at least PHP %s to run.", PHP_VERSION, '5.4.0');
    echo '</p></div>';
}

function gantry5_install_prepare_options($options)
{
//    $options['abort_if_destination_exists'] = 0;
    return $options;
}

function gantry5_install_clear_cache($upgrader, $options)
{
    // Clear gantry cache after plugin / theme installs.
    if (isset($options['type']) && in_array($options['type'], array('plugin', 'theme')) && class_exists('Gantry\Framework\Gantry')) {
        global $wp_filesystem;

        $gantry = \Gantry\Framework\Gantry::instance();
        $path = $gantry['platform']->getCachePath();
        if ($wp_filesystem->is_dir($path)) {
            $wp_filesystem->rmdir($path);
        }
        $upgrader->skin->feedback('Gantry 5 cache cleared.');
    }
}

