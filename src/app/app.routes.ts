import { Routes } from '@angular/router';

import { PublicLayout } from './layouts/public-layout/public-layout';
import { AppLayout } from './layouts/app-layout/app-layout';

import { Items } from './pages/items/items';
import { Accounts } from './pages/accounts/accounts';
import { Storage } from './pages/storage/storage';

import { Auth } from './pages/auth/auth';
import { Home } from './pages/home/home';
import { Machines } from './pages/machines/machines';

export const routes: Routes = [
  { path: 'accounts', redirectTo: 'app/accounts', pathMatch: 'full' },

  {
    path: '',
    component: PublicLayout,
    children: [
      {path: '', redirectTo: 'home', pathMatch: "full"},
      {path: 'auth', component: Auth},
      {path: 'home', component: Home},
    ]
  },

  {
    path: 'app',
    component: AppLayout,
    children: [
      { path: '', redirectTo: 'items', pathMatch: 'full' },
      { path: 'items', component: Items },
      { path: 'accounts', component: Accounts },
      { path: 'storage', component: Storage },
      { path: 'machines' , component: Machines},
    ]
  },

  { path: '**', redirectTo: 'app/items' }
];
