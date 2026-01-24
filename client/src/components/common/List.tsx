import FilterDropdown, { FilterDropProps } from "./FilterDropdown";
import "./List.css";
interface ListProps<T> {
    items: T[];
    filterDropProp?: FilterDropProps;
    renderItem: (item: T) => React.ReactNode;
}

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