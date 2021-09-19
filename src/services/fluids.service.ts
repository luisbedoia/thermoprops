import { Injectable } from '@angular/core';
import  Fluids from '../assets/json/all_fluids.json'

@Injectable({
    providedIn: 'root'
})
export class FluidsService {
    public fluid_list = Fluids.map((x,i)=>{
        return {
            index: i,
            name: x.INFO.NAME,
            aliases: x.INFO.ALIASES
        }
    })

}