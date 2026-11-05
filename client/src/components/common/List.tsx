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
                <div className="flex flex-col md:flex-row items-center justify-start gap-3 w-full p-2.5 rounded-xl bg-black/5 dark:bg-black/30 shadow-inner border border-[var(--tg-hairline)] mb-3">
                    <FilterDropdown
                        filter={props.filterDropProp?.filter}
                        setFilter={props.filterDropProp?.setFilter}
                        options={props.filterDropProp?.options}
                    />
                </div>
            )}
            <div className="w-full rounded-xl overflow-hidden">
                <div className="overflow-y-auto max-h-[950px] [scrollbar-color:var(--scrollbar-thumb)_transparent]">
                    {props.items.map((item, index) => (
                        <div key={index}>
                            {props.renderItem(item)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default List;