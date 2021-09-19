import { Component, HostListener, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms'
import {  Observable, interval } from 'rxjs';
import {map, startWith} from 'rxjs/operators';
import { FluidsService } from '../services/fluids.service'
declare var Module: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent implements OnInit {
  constructor(
    private fluidsService: FluidsService
  ) { }
  title = 'thermoprops';
  loaded: boolean = false;
  fluidList: any[]=[]
  selectedFluid = new FormControl();
  filteredOptions: Observable<any[]> = new Observable<any[]>();
  resultado = '';
  ngOnInit() {
    this.checkIfLoaded()
    this.filteredOptions = this.selectedFluid.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value))
    );

    interval(500).subscribe(x => {
      if(typeof Module.get_global_param_string !== 'undefined') {
        // this.fluidList = Module.get_global_param_string('fluids_list').split(',');
        this.fluidList = this.fluidsService.fluid_list;
        this.loaded = true;
      }
    });
    
  }

  calculate(){
    if(this.selectedFluid.value){
      this.resultado = Module.PropsSI('D', 'T', 298.15, 'P', 101325, this.selectedFluid.value.name);
    }
    
  }

  private _filter(value: any): string[] {
    let filterValue: any;
    if(typeof value == 'string'){
      filterValue = value.toLowerCase();
    } else {
      filterValue = value?  value['name'].toLowerCase() : ''
    }
    
    return this.fluidList.filter(fluid => fluid.name.toLowerCase().includes(filterValue));
  }

  checkIfLoaded(){
    window.addEventListener('load', (event) => {
      console.log(event);
    })
  }

  displayFn(object: any): string {
    return object && object.name ? object.name : '';
  }
  
}
