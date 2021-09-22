import { Component, HostListener, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms'
import {  Observable, interval } from 'rxjs';
import {map, startWith} from 'rxjs/operators';
import { FluidsService } from '../services/fluids.service'
declare var Module: any;

interface Property{
  id?:number;
  units?: string;
  key?: string;
  type?: string;
  value?: string;
}

let properties: Property[] = [
  {
    id:0,
    key:'P',
    units:"Pa",
    type:"Pressure"
  },
  {
    id:1,
    key:"T",
    units:"K",
    type: "Temperature"
  },
  {
    id:2,
    key:"H",
    units:"J/kg",
    type: "Mass specific enthalpy"
  },
  {
    id:3,
    key: "D",
    units:"kg/m^3",
    type:"Mass density"
  },
  {
    id:4,
    key:"Q",
    units:"mol/mol",
    type: "Mass vapor quality"
  },
  {
    id:5,
    key:"S",
    units:"J/kg/K",
    type: "Mass specific entropy"
  },
  {
    id:6,
    key:"U",
    units:"J/kg",
    type:"Mass specific internal energy"
  }
];

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
  availableProps1: Property[] = properties;
  availableProps2: Property[] = properties;
  selectedProps: Property[] = [];
  results: Property[] = properties;
  prop1: Property = {value:''};
  prop2: Property = {value:''};
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
    this.selectedProps=[this.prop1,this.prop2]
    if(this.selectedFluid.value){
      this.results.map((x,i)=>{
        // if(x.id!==this.prop1.id || x.id!==this.prop2.id){
          this.results[i].value = Module.PropsSI(x.key, this.prop1.key, parseFloat(this.prop1.value? this.prop1.value : "0"), this.prop2.key, parseFloat(this.prop2.value? this.prop2.value: "0"), this.selectedFluid.value.name);
        // }
      })

      console.log(this.results)
      
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

  onSelectProperty(event: any){
    if(this.prop1 && this.prop1.id==event.id){
      this.availableProps2 = properties.filter((x)=>{
        return x.id!==event.id
      })
      this.availableProps1 = properties.filter((x)=>{
        return x.id==event.id
      })
    }

    if(this.prop2 && this.prop2.id==event.id){
      this.availableProps1 = properties.filter((x)=>{
        return x.id!==event.id
      })
      this.availableProps2 = properties.filter((x)=>{
        return x.id==event.id
      })
    }
  }
  
}
