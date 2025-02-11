<?php
/**
 * @package   Gantry5
 * @author    RocketTheme http://www.rockettheme.com
 * @copyright Copyright (C) 2007 - 2015 RocketTheme, LLC
 * @license   MIT
 *
 * http://opensource.org/licenses/MIT
 */

namespace Gantry\Framework;

use Grav\Common\Grav;

class Gantry extends Base\Gantry
{
    /**
     * @throws \LogicException
     */
    protected static function load()
    {
        $container = parent::load();

        // Use locator from Grav.
        $container['locator'] = function($c) {
            return Grav::instance()['locator'];
        };

        return $container;
    }

    /**
     * @return array
     */
    protected static function loadGlobal()
    {
        $grav = Grav::instance();
        return (array) $grav['config']->get('plugins.gantry5');
    }
}
