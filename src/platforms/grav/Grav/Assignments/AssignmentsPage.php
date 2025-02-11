<?php
/**
 * @package   Gantry5
 * @author    RocketTheme http://www.rockettheme.com
 * @copyright Copyright (C) 2007 - 2015 RocketTheme, LLC
 * @license   MIT
 *
 * http://opensource.org/licenses/MIT
 */

namespace Gantry\Grav\Assignments;

use Gantry\Component\Assignments\AssignmentsInterface;
use Grav\Common\Grav;
use Grav\Common\Page\Page;

class AssignmentsPage implements AssignmentsInterface
{
    public $type = 'page';
    public $priority = 1;

    /**
     * Returns list of rules which apply to the current page.
     *
     * @return array
     */
    public function getRules()
    {
        $grav = Grav::instance();
        $route = trim($grav['page']->route(), '/');

        $rules = [];

        $rules[$route ?: 'home'] = $this->priority;

        return [$rules];
    }

    /**
     * List all the rules available.
     *
     * @return array
     */
    public function listRules()
    {
        // Get label and items for each menu
        $list = [
                'label' => 'Pages',
                'items' => $this->getItems()
        ];

        return [$list];
    }

    protected function getItems()
    {
        $grav = Grav::instance();

        // Initialize pages.
        $pages = $grav['pages']->all()->routable();

        $items = [];

        /** @var Page $page */
        foreach ($pages as $page) {
            $route = trim($page->route(), '/');
            $items[] = [
                'name' => $route,
                'field' => ['id', 'link/' . $route],
                'disabled' => !$page->isPage(),
                'label' => str_repeat('—', substr_count($route, '/')) . ' ' . $page->title(),
            ];
        }

        return $items;
    }
}
