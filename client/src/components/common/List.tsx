import FilterDropdown, { FilterDropProps } from "./FilterDropdown";
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
            {props.filterDropProp && (
                <div className="flex flex-col md:flex-row items-center justify-start gap-4 w-full bg-form-bg p-4 rounded-xl shadow-inner border border-border-main/10 mb-4">
                    <FilterDropdown
                        filter={props.filterDropProp?.filter}
                        setFilter={props.filterDropProp?.setFilter}
                        options={props.filterDropProp?.options}
                    />
                </div>
            )}
            <div className="w-full rounded-lg overflow-hidden border border-border-main/10">
                <div className="overflow-y-auto max-h-[600px] [scrollbar-color:var(--scrollbar-thumb)_transparent]">
                    {props.items.map((item, index) => (
                        <div key={index} className={index % 2 === 0 ? "bg-even-row" : "bg-transparent"}>
                            {props.renderItem(item)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default List;