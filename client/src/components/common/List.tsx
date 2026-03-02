import FilterDropdown, { FilterDropProps } from "./FilterDropdown";
import "./List.css";
interface ListProps<T> {
    items: T[];
    filterDropProp?: FilterDropProps;
    renderItem: (item: T) => React.ReactNode;
}

/**
 * List Component
 * 
 * A generic, highly reusable list container component.
 * It loops over an array of `items` of type `T` and conditionally renders an even/odd 
 * CSS class for zebra-striping. It also accepts an optional `filterDropProp` object 
 * to render a `FilterDropdown` above the list items.
 * 
 * @param {T[]} items - The array of data objects to render.
 * @param {function} renderItem - A render prop function that defines how each item `T` should look.
 */
const List = <T,>(props: ListProps<T>) => {
    return (
        <div>
            {props.filterDropProp && <div className="list-header">
                <FilterDropdown
                    filter={props.filterDropProp?.filter}
                    setFilter={props.filterDropProp?.setFilter}
                    options={props.filterDropProp?.options}
                />
            </div>}
            <div className="list-body">
                {props.items.map((item, index) => (
                    <div key={index} className={`list-item-${index % 2 ? "odd" : "even" }` }>
                        {props.renderItem(item)}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default List;