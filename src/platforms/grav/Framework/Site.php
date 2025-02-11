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

use Grav\Common\GravTrait;

class Site
{
    use GravTrait;

    public function __construct()
    {
        $grav = static::$grav;
        $config = $grav['config'];
        $uri = $grav['uri'];
        $this->theme = $config->get('system.theme');
        $this->url = $uri->rootUrl();
        $this->title = $config->get('site.title');
        $this->description = $config->get('site.description');
    }
}
