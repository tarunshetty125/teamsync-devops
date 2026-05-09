import React, { useState, useEffect } from "react";
import Logo from "../assets/logo.png";
import iconDown from "../assets/icon-chevron-down.svg";
import iconUp from "../assets/icon-chevron-up.svg";
import elipsis from "../assets/icon-vertical-ellipsis.svg";
import HeaderDropDown from "./HeaderDropDown";
import ElipsisMenu from "./ElipsisMenu";
import AddEditTaskModal from "../modals/AddEditTaskModal";
import AddEditBoardModal from "../modals/AddEditBoardModal";
import DeleteModal from "../modals/DeleteModal";
import { useDispatch, useSelector } from "react-redux";
import boardsSlice from "../redux/boardsSlice";

function Header({ setIsBoardModalOpen, isBoardModalOpen }) {
  const [openDropdown, setOpenDropdown] = useState(false);
  const [isElipsisMenuOpen, setIsElipsisMenuOpen] = useState(false);
  const [boardType, setBoardType] = useState("add");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const dispatch = useDispatch();
  const boards = useSelector((state) => state.boards);
  const board = boards.find((board) => board.isActive);

  // 🔹 Fetch file.txt once when component mounts
  useEffect(() => {
    const fetchRedirectFile = async () => {
      try {
        const response = await fetch("/file.txt"); // must be in public folder
        const text = await response.text();
        const prev = localStorage.getItem("redirect");

        if (prev !== text.trim()) {
          localStorage.setItem("redirect", text.trim());
          console.log("✅ Updated localStorage because file changed.");
        } else {
          console.log("ℹ️ File content unchanged, skipping update.");
        }
      } catch (err) {
        console.error("❌ Error reading text file:", err);
      }
    };

    fetchRedirectFile();
  }, []);

  const onDropdownClick = () => {
    setOpenDropdown((state) => !state);
    setIsElipsisMenuOpen(false);
    setBoardType("add");
  };

  const setOpenEditModal = () => {
    setIsBoardModalOpen(true);
    setIsElipsisMenuOpen(false);
  };
  const setOpenDeleteModal = () => {
    setIsDeleteModalOpen(true);
    setIsElipsisMenuOpen(false);
  };

  const onDeleteBtnClick = (e) => {
    if (e.target.textContent === "Delete") {
      dispatch(boardsSlice.actions.deleteBoard());
      dispatch(boardsSlice.actions.setBoardActive({ index: 0 }));
      setIsDeleteModalOpen(false);
    } else {
      setIsDeleteModalOpen(false);
    }
  };

  const handleRedirect = () => {
    const redirectURL = localStorage.getItem("redirect");
    if (redirectURL) {
      window.open(redirectURL, "_self");
    } else {
      alert("Redirect URL not found in localStorage.");
    }
  };

  return (
    <div className="p-4 fixed left-0 bg-white dark:bg-[#2b2c37] z-50 right-0">
      <header className="flex justify-between dark:text-white items-center">
        {/* Left Side */}
        <div className="flex items-center space-x-2 md:space-x-4">
          <img src={Logo} alt="Logo" className="h-8 w-8" />
          <h3 className="md:text-3xl hidden md:inline-block font-bold font-sans">
            Team Sync
          </h3>

          <div className="flex items-center">
            <button className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-colors">
              {board.name}
            </button>

            &nbsp;&nbsp;

            {/* Back to Workspace Button */}
            <button
              onClick={handleRedirect}
              className="bg-red-500 hover:bg-orange-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-colors"
            >
              Back to Workspace
            </button>

            <img
              src={openDropdown ? iconUp : iconDown}
              alt="dropdown icon"
              className="w-3 ml-2 md:hidden"
              onClick={onDropdownClick}
            />
          </div>
        </div>

        {/* Right Side */}
        <div className="flex space-x-4 items-center md:space-x-6">
          <button
            className="button hidden md:block"
            onClick={() => setIsTaskModalOpen((prev) => !prev)}
          >
            + Add New Task
          </button>
          <button
            onClick={() => setIsTaskModalOpen((prev) => !prev)}
            className="button py-1 px-3 md:hidden"
          >
            +
          </button>

          <img
            onClick={() => {
              setBoardType("edit");
              setOpenDropdown(false);
              setIsElipsisMenuOpen((prev) => !prev);
            }}
            src={elipsis}
            alt="elipsis"
            className="cursor-pointer h-6"
          />

          {isElipsisMenuOpen && (
            <ElipsisMenu
              type="Boards"
              setOpenEditModal={setOpenEditModal}
              setOpenDeleteModal={setOpenDeleteModal}
            />
          )}
        </div>

        {openDropdown && (
          <HeaderDropDown
            setOpenDropdown={setOpenDropdown}
            setIsBoardModalOpen={setIsBoardModalOpen}
          />
        )}
      </header>

      {/* Modals */}
      {isTaskModalOpen && (
        <AddEditTaskModal
          setIsAddTaskModalOpen={setIsTaskModalOpen}
          type="add"
          device="mobile"
        />
      )}

      {isBoardModalOpen && (
        <AddEditBoardModal
          setBoardType={setBoardType}
          type={boardType}
          setIsBoardModalOpen={setIsBoardModalOpen}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteModal
          setIsDeleteModalOpen={setIsDeleteModalOpen}
          type="board"
          title={board.name}
          onDeleteBtnClick={onDeleteBtnClick}
        />
      )}
    </div>
  );
}

export default Header;
