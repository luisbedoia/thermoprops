import { Component, HostListener, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms'
import {  Observable, interval } from 'rxjs';
import {map, startWith} from 'rxjs/operators';
declare var Module: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent implements OnInit {
  constructor(
  ) { }
  title = 'thermoprops';
  loaded: boolean = false;
  fluidList: string[]=[]
  selectedFluid = new FormControl();
  filteredOptions: Observable<string[]> = new Observable<string[]>();
  resultado = '';
  ngOnInit() {
    this.checkIfLoaded()
    this.filteredOptions = this.selectedFluid.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value))
    );

    interval(500).subscribe(x => {
      if(typeof Module.get_global_param_string !== 'undefined') {
        this.fluidList = Module.get_global_param_string('fluids_list').split(',');
        this.loaded = true;
      }
    });
    
  }

  calculate(){
    if(this.selectedFluid.value){
      this.resultado = Module.PropsSI('D', 'T', 298.15, 'P', 101325, this.selectedFluid.value);
    }
    
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.fluidList.filter(fluid => fluid.toLowerCase().includes(filterValue));
  }

  checkIfLoaded(){
    window.addEventListener('load', (event) => {
      console.log(event);
    })
  }
  
}
