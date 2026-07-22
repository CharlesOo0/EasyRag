import {Outlet} from "react-router";

export default function AuthIndex() {
    return (
        <div className="w-full min-h-screen">
            <Outlet/>
        </div>
    )
}