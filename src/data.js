export const INITIAL_ORDERS = [
  {
    id: 1, source: 'dine-in', num: '#45', name: 'Table 3',
    elapsed: 24, sched: null, note: null, status: 'open',
    items: [
      { id: 101, qty: 2, name: 'Margherita', cat: 'pizza', done: false, mods: [
        { t: 'variant', v: 'Large' },
        { t: 'remove',  v: 'Basil' },
        { t: 'extra',   v: 'Mozzarella', qty: 1 },
        { t: 'dietary', v: 'Gluten Free Base' },
      ]},
      { id: 102, qty: 1, name: 'Bruschetta', cat: 'entree', done: false, mods: [] },
      { id: 103, qty: 2, name: 'Soft Drink', cat: 'drinks', done: false, mods: [{ t: 'variant', v: 'Lemonade' }] },
    ],
  },

  {
    id: 2, source: 'pos-takeaway', num: '#46', name: 'James O.',
    elapsed: 16, sched: '6:15pm', note: null, status: 'open',
    items: [
      { id: 201, qty: 1, name: 'BBQ Chicken Pizza', cat: 'pizza', done: false, comment: 'Pack it for takeaway', mods: [
        { t: 'variant', v: 'Large' },
        { t: 'variant', v: 'Thin Crust' },
        { t: 'extra',   v: 'Chicken', qty: 1 },
        { t: 'add',     v: 'Jalapeño' },
        { t: 'add',     v: 'Red Onion' },
        { t: 'dietary', v: 'Halal Meat' },
      ]},
      { id: 202, qty: 1, name: 'Cheesy Garlic Bread', cat: 'breads', done: false, comment: 'Wrap separately', mods: [] },
      { id: 203, qty: 1, name: 'Soft Drink', cat: 'drinks', done: false, mods: [{ t: 'variant', v: 'Pepsi' }] },
    ],
  },

  {
    id: 3, source: 'web-delivery', num: '#47', name: 'Sophie M.',
    elapsed: 6, sched: '6:30pm', note: null, status: 'open',
    items: [
      { id: 301, qty: 1, name: 'Meat Lovers Pizza', cat: 'pizza', done: false, mods: [
        { t: 'variant', v: 'XL' },
        { t: 'variant', v: 'Stuffed Crust' },
        { t: 'extra',   v: 'Pepperoni', qty: 2 },
        { t: 'extra',   v: 'Bacon', qty: 1 },
        { t: 'add',     v: 'Jalapeño' },
        { t: 'add',     v: 'Sun-dried Tomato' },
        { t: 'dietary', v: 'Halal Meat' },
      ]},
      { id: 302, qty: 1, name: 'Penne Arrabbiata', cat: 'pasta', done: false, mods: [
        { t: 'variant', v: 'Extra Spicy' },
        { t: 'add',     v: 'Parmesan' },
      ]},
      { id: 303, qty: 2, name: 'Garlic Bread', cat: 'breads', done: false, mods: [] },
    ],
  },

  {
    id: 4, source: 'uber', num: '#48', name: 'Uber #4421',
    elapsed: 21, sched: '6:00pm', note: null, status: 'open',
    items: [
      { id: 401, qty: 2, name: 'Pepperoni Pizza', cat: 'pizza', done: false, mods: [
        { t: 'variant', v: 'Medium' },
        { t: 'extra',   v: 'Pepperoni', qty: 1 },
      ]},
      { id: 402, qty: 1, name: 'Arancini (4 pcs)', cat: 'entree', done: false, mods: [] },
      { id: 403, qty: 1, name: 'Caesar Salad', cat: 'salads', done: false, comment: 'Dressing on the side please', mods: [
        { t: 'remove', v: 'Anchovies' },
        { t: 'add',    v: 'Grilled Chicken' },
      ]},
      { id: 404, qty: 2, name: 'Tiramisu', cat: 'desserts', done: false, mods: [] },
    ],
  },

  {
    id: 5, source: 'dine-in', num: '#49', name: 'Table 7',
    elapsed: 11, sched: null, note: 'Fully vegan table — no animal products', status: 'open',
    items: [
      { id: 501, qty: 1, name: 'Truffle Mushroom Pizza', cat: 'pizza', done: false, mods: [
        { t: 'variant', v: 'Large' },
        { t: 'remove',  v: 'Onion' },
        { t: 'add',     v: 'Rocket' },
        { t: 'add',     v: 'Truffle Oil' },
        { t: 'dietary', v: 'Vegan Cheese' },
        { t: 'dietary', v: 'Gluten Free Base' },
      ]},
      { id: 502, qty: 1, name: 'Pesto Pasta', cat: 'pasta', done: false, mods: [
        { t: 'add',     v: 'Pine Nuts' },
        { t: 'dietary', v: 'Dairy Free' },
      ]},
      { id: 503, qty: 2, name: 'House Salad', cat: 'salads', done: false, mods: [
        { t: 'remove', v: 'Croutons' },
        { t: 'remove', v: 'Feta' },
      ]},
    ],
  },

  {
    id: 6, source: 'pos-delivery', num: '#50', name: 'Chris W.',
    elapsed: 8, sched: '6:45pm', note: null, status: 'open',
    items: [
      { id: 601, qty: 1, name: 'Hawaiian Pizza', cat: 'pizza', done: false, mods: [
        { t: 'variant', v: 'Large' },
        { t: 'remove',  v: 'Pineapple' },
        { t: 'add',     v: 'Jalapeño' },
        { t: 'add',     v: 'Bacon' },
        { t: 'dietary', v: 'Halal Meat' },
      ]},
      { id: 602, qty: 1, name: 'Lasagne', cat: 'pasta', done: false, comment: 'Extra hot please', mods: [
        { t: 'extra', v: 'Beef', qty: 1 },
      ]},
      { id: 603, qty: 1, name: 'Panna Cotta', cat: 'desserts', done: false, mods: [
        { t: 'variant', v: 'Vanilla' },
        { t: 'add',     v: 'Berry Coulis' },
      ]},
    ],
  },

  {
    id: 7, source: 'ai-order', num: '#51', name: 'AI — Voice Order',
    elapsed: 4, sched: '7:30pm', sched_date: 'Sun 25 May', note: 'Placed via AI voice assistant', status: 'open',
    items: [
      { id: 701, qty: 1, name: 'Spaghetti Bolognese', cat: 'pasta', done: false, mods: [
        { t: 'extra',   v: 'Meat Sauce', qty: 1 },
        { t: 'add',     v: 'Parmesan' },
        { t: 'dietary', v: 'Halal Meat' },
      ]},
      { id: 702, qty: 1, name: 'Fettuccine Alfredo', cat: 'pasta', done: false, mods: [
        { t: 'add',     v: 'Grilled Chicken' },
        { t: 'dietary', v: 'Dairy Free' },
      ]},
      { id: 703, qty: 2, name: 'Cheesy Garlic Bread', cat: 'breads', done: false, mods: [] },
    ],
  },

  {
    id: 8, source: 'web-takeaway', num: '#52', name: 'Emma T.',
    elapsed: 18, sched: '12:30pm', sched_date: 'Tomorrow', note: '⚠ Severe nut allergy — no pesto or pine nuts', status: 'open',
    items: [
      { id: 801, qty: 1, name: 'Margherita', cat: 'pizza', done: false, mods: [
        { t: 'variant', v: 'Medium' },
        { t: 'add',     v: 'Spinach' },
        { t: 'add',     v: 'Roasted Capsicum' },
        { t: 'dietary', v: 'Vegan Cheese' },
      ]},
      { id: 802, qty: 1, name: 'Caesar Salad', cat: 'salads', done: false, mods: [
        { t: 'remove', v: 'Croutons' },
        { t: 'remove', v: 'Anchovies' },
        { t: 'add',    v: 'Grilled Chicken' },
      ]},
      { id: 803, qty: 1, name: 'Garlic Bread', cat: 'breads', done: false, mods: [] },
      { id: 804, qty: 1, name: 'Tiramisu', cat: 'desserts', done: false, mods: [] },
    ],
  },

  {
    id: 10, source: 'dine-in', num: '#32', name: 'Table 5',
    elapsed: 7, sched: null, note: null, status: 'open',
    items: [
      { id: 1001, qty: 1, name: 'Amici Special Pizza', cat: 'pizza', done: false, mods: [
        { t: 'variant',  v: 'Large Size' },
        { t: 'variant',  v: 'Thin Crust Base' },
        { t: 'remove',   v: 'Mushrooms' },
        { t: 'remove',   v: 'Onion' },
        { t: 'extra',    v: 'Chicken', qty: 1 },
        { t: 'add',      v: 'Salami' },
        { t: 'add',      v: 'Pineapple' },
        { t: 'add',      v: 'Olives' },
        { t: 'add',      v: 'Sausages' },
        { t: 'dietary',  v: 'Vegan Cheese' },
        { t: 'dietary',  v: 'Halal Meat' },
      ]},
      { id: 1002, qty: 2, name: 'Garlic Bread', cat: 'breads', done: false, mods: [] },
      { id: 1003, qty: 2, name: 'Soft Drink', cat: 'drinks', done: false, mods: [{ t: 'variant', v: 'Coke' }] },
    ],
  },

  {
    id: 9, source: 'pos-takeaway', num: '#44', name: 'Mark R.',
    elapsed: 28, sched: '5:45pm', note: null, status: 'completed',
    items: [
      { id: 901, qty: 1, name: 'Pepperoni Pizza', cat: 'pizza', done: true, mods: [{ t: 'variant', v: 'Medium' }] },
      { id: 902, qty: 1, name: 'Cheesy Garlic Bread', cat: 'breads', done: true, mods: [] },
      { id: 903, qty: 2, name: 'Soft Drink', cat: 'drinks', done: true, mods: [{ t: 'variant', v: 'Coke' }] },
    ],
  },
]
