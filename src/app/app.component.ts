import { Component, OnInit, DoCheck } from '@angular/core';
import { FormControl } from '@angular/forms'
import { Observable } from 'rxjs';
import {map, startWith} from 'rxjs/operators';
declare var Module: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent implements OnInit, DoCheck {
  title = 'thermoprops';
  loaded: boolean = false;
  fluidList: string[] = []
  selectedFluid = new FormControl();
  filteredOptions: Observable<string[]> = new Observable<string[]>();
  ngOnInit() {
      this.filteredOptions = this.selectedFluid.valueChanges.pipe(
        startWith(''),
        map(value => this._filter(value))
      );
  }

  ngDoCheck(){
    if(Module.get_global_param_string && !this.loaded){
      this.fluidList = Module.get_global_param_string('fluids_list').split(',');
      this.loaded = true;
    }
  }

  PropsSI(){
    this.fluidList = Module.get_global_param_string('fluids_list').split(',');
    let a = Module.PropsSI('D', 'T', 298.15, 'P', 101325, 'Nitrogen');
    console.log(a)
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.fluidList.filter(fluid => fluid.toLowerCase().includes(filterValue));
  }
}
