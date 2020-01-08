
import { Component, OnInit, EventEmitter, Output, OnDestroy, ViewChild } from '@angular/core';

import { ConfigService } from '../../services/config.service';

import { Subscription } from 'rxjs';

import { AuthService } from 'src/app/services/auth.service';

import { MessageService } from 'primeng/api';

import { FilterService } from '../../services/filter.service';

import { SidebarService } from 'src/app/services/sidebar.service';

import { MapService } from 'src/app/services/map.service';

import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {

  @Output() showHideSidebarClicked = new EventEmitter<boolean>();

  @ViewChild('dataFilter', {static: true}) datePicker;

  private userSub: Subscription;

  loggedUserName: string;

  isAuthenticated = false;

  // -- Filter --
  private filterConfig;
  dateInput;
  maxDate = new Date();
  dateField;
  optionField;

  displaySidebar = true;
  displayLogin = false;
  displayAbout = false;

  hasLogin = false;

  headerTitle: string;
  headerLogo: string;
  headerLogoLink: string;
  mainApplication: string;

  appConfig;

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
    private messageService: MessageService,
    private filterService: FilterService,
    private sidebarService: SidebarService,
    private mapService: MapService
  ) {}

  ngOnInit() {
    this.setFilterSettings();

    this.appConfig = this.configService.getAppConfig();
    this.mainApplication = this.appConfig.mainApplication;
    this.headerLogoLink = this.appConfig.headerLogoLink;
    this.headerTitle = this.appConfig.headerTitle;
    this.headerLogo = this.appConfig.headerLogo;
    this.hasLogin = this.appConfig.hasLogin;

    this.userSub = this.authService.user.subscribe(user => {
      if (user) {
        this.isAuthenticated = true;
        this.loggedUserName = user.username;
      }
    });

  }

  setFilterSettings() {
    this.filterConfig = this.configService.getMapConfig('filter');
    this.dateField = this.filterConfig.date;
    this.optionField = this.filterConfig.optionField;

    this.setDefaultDate();
  }

  setDefaultDate() {
    const currentDate = new Date();
    let firstDate = new Date('01/01/' + currentDate.getFullYear());
    if (!environment.production) {
      firstDate = new Date('01/01/2001');
    } else {
      firstDate = new Date('01/01/' + currentDate.getFullYear());
    }
    const currentDateInput = JSON.parse(localStorage.getItem('dateFilter'));

    if (JSON.parse(localStorage.getItem('dataFilter')) !== null) {
      localStorage.removeItem('dataFilter');
    }

    if (currentDateInput !== null) {
      this.dateInput = [new Date(currentDateInput[0]), new Date(currentDateInput[1])];
    } else {
      this.dateInput = [firstDate, currentDate];
      localStorage.setItem('dateFilter', JSON.stringify(this.dateInput));
    }
  }

  showHideSidebar() {
    this.displaySidebar = !this.displaySidebar;
    this.showHideSidebarClicked.emit(this.displaySidebar);
  }

  onLoginClick() {
    this.displayLogin = true;
  }

  onCloseLoginClick(displayLogin: boolean) {
    this.displayLogin = displayLogin;
  }

  onLogoutClick() {
    this.authService.logout();
    this.isAuthenticated = false;
    this.loggedUserName = '';
    this.messageService.add(
      {
        severity: 'success',
        summary: 'Logout',
        detail: 'Logout realizado com successo!'
      }
    );
    this.sidebarService.sidebarReload.next();
    this.mapService.clearMap.next();
  }

  openAbout() {
    this.displayAbout = true;
  }

  closeAbout(displayAbout: boolean) {
    this.displayAbout = displayAbout;
  }

  ngOnDestroy() {
    this.userSub.unsubscribe();
  }

  onFilterClose() {
    this.setDefaultDate();
  }

  onTodayClick() {
    const rangeCurrent = this.getCurrentFilterValues();

    this.updateCurrentDateRange(rangeCurrent);
  }

  getCurrentFilterValues() {
    const date: Date = new Date();

    return {
      firstDate: {
        day: 1,
        month: 0,
        year: date.getFullYear(),
        today: false,
        selectable: false
      },
      currentDate: {
        day: date.getDay(),
        month: date.getMonth(),
        year: date.getFullYear(),
        today: true, selectable: true
      }
    };
  }

  updateCurrentDateRange(dateRange) {
    this.updateCurrentDate(dateRange.currentDate);

    this.datePicker.selectDate(dateRange.firstDate);
    this.datePicker.selectDate(dateRange.currentDate);

    this.datePicker.updateInputfield();
  }

  updateCurrentDate(currentDate) {
    this.datePicker.currentMonth = currentDate.month;
    this.datePicker.currentYear = currentDate.year;

    this.datePicker.createMonth(this.datePicker.currentMonth, this.datePicker.currentYear);
  }

  onFilterClick() {
    localStorage.setItem('dateFilter', JSON.stringify(this.dateInput));
    this.datePicker.overlayVisible = false;

    this.filterService.filterMap.next();
    this.filterService.filterTable.next();
    this.filterService.filterReport.next();
    this.filterService.filterDashboard.next();
  }

  showFilter() {
    this.filterService.displayFilter.next();
  }
}
